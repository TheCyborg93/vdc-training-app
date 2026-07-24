import { HomeSessionStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyVisit, createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";

type PlanItem = { exerciseId: number; durationMin: number; position?: number };
type StoredState = { exerciseIndex: number; exerciseState: PlayerExerciseState };

function readItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item as PlanItem).filter((item) => Number.isInteger(Number(item.exerciseId)));
}

function readState(value: unknown): StoredState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  const exerciseIndex = Number(state.exerciseIndex);
  const exerciseState = state.exerciseState;
  if (!Number.isInteger(exerciseIndex) || !exerciseState || typeof exerciseState !== "object" || Array.isArray(exerciseState)) return null;
  return { exerciseIndex, exerciseState: exerciseState as PlayerExerciseState };
}

async function loadPlan(planId: number) {
  const plan = await prisma.homeTrainingPlan.findUnique({ where: { id: planId } });
  if (!plan) return null;
  const items = readItems(plan.planJson);
  const exercises = await prisma.exercise.findMany({ where: { id: { in: items.map((item) => Number(item.exerciseId)) } } });
  const map = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return { plan, items, exercises: items.map((item) => map.get(Number(item.exerciseId))).filter(Boolean) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "start") {
      const planId = Number(body.planId);
      const playerId = Number(body.playerId);
      if (!Number.isInteger(planId) || !Number.isInteger(playerId)) return NextResponse.json({ error: "Plan und Spieler sind erforderlich." }, { status: 400 });

      const loaded = await loadPlan(planId);
      if (!loaded || loaded.plan.playerId !== playerId || !loaded.exercises[0]) return NextResponse.json({ error: "Heimtrainingsplan wurde nicht gefunden." }, { status: 404 });

      const existing = await prisma.homeTrainingSession.findFirst({
        where: { homeTrainingPlanId: planId, playerId, status: { in: [HomeSessionStatus.RUNNING, HomeSessionStatus.PAUSED] } },
        orderBy: { updatedAt: "desc" },
        include: { results: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      });
      if (existing) return NextResponse.json({ session: existing, resumed: true });

      const state: StoredState = { exerciseIndex: 0, exerciseState: createInitialExerciseState(loaded.exercises[0]!) };
      const session = await prisma.homeTrainingSession.create({
        data: { homeTrainingPlanId: planId, playerId, status: HomeSessionStatus.RUNNING, exerciseIndex: 0, stateJson: state as Prisma.InputJsonValue },
        include: { results: true },
      });
      return NextResponse.json({ session, resumed: false }, { status: 201 });
    }

    const sessionId = Number(body.sessionId);
    if (!Number.isInteger(sessionId)) return NextResponse.json({ error: "Heimtrainingseinheit ist erforderlich." }, { status: 400 });

    const session = await prisma.homeTrainingSession.findUnique({ where: { id: sessionId }, include: { plan: true } });
    if (!session) return NextResponse.json({ error: "Heimtrainingseinheit wurde nicht gefunden." }, { status: 404 });

    if (action === "pause" || action === "resume") {
      const status = action === "pause" ? HomeSessionStatus.PAUSED : HomeSessionStatus.RUNNING;
      const updated = await prisma.homeTrainingSession.update({
        where: { id: sessionId },
        data: action === "pause" ? { status, pausedAt: new Date() } : { status, pausedAt: null },
      });
      return NextResponse.json({ session: updated });
    }

    if (action === "cancel" || action === "finish") {
      const status = action === "cancel" ? HomeSessionStatus.CANCELLED : HomeSessionStatus.COMPLETED;
      const updated = await prisma.homeTrainingSession.update({ where: { id: sessionId }, data: { status, completedAt: new Date() } });
      return NextResponse.json({ session: updated, completed: status === HomeSessionStatus.COMPLETED });
    }

    if (action !== "visit" || !body.value || typeof body.value !== "object") {
      return NextResponse.json({ error: "Unbekannte Aktion oder fehlende Aufnahme." }, { status: 400 });
    }
    if (session.status !== HomeSessionStatus.RUNNING) return NextResponse.json({ error: "Diese Heimtrainingseinheit läuft aktuell nicht." }, { status: 409 });

    const loaded = await loadPlan(session.homeTrainingPlanId);
    const stored = readState(session.stateJson);
    if (!loaded || !stored) return NextResponse.json({ error: "Der gespeicherte Trainingsstand ist ungültig." }, { status: 409 });

    const currentItem = loaded.items[stored.exerciseIndex];
    const currentExercise = loaded.exercises[stored.exerciseIndex];
    if (!currentItem || !currentExercise) return NextResponse.json({ error: "Aktuelle Übung wurde nicht gefunden." }, { status: 409 });

    const applied = applyVisit(currentExercise, stored.exerciseState, body.value as Record<string, unknown>);
    let nextExerciseIndex = stored.exerciseIndex;
    let nextExerciseState = applied.nextState;
    let exerciseCompleted = applied.playerFinished;
    let completed = false;

    if (exerciseCompleted) {
      nextExerciseIndex += 1;
      const nextExercise = loaded.exercises[nextExerciseIndex];
      if (!nextExercise) completed = true;
      else nextExerciseState = createInitialExerciseState(nextExercise);
    }

    const nextState: StoredState = { exerciseIndex: completed ? stored.exerciseIndex : nextExerciseIndex, exerciseState: nextExerciseState };
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.homeExerciseResult.create({
        data: {
          homeTrainingSessionId: session.id,
          exerciseId: currentExercise.id,
          playerId: session.playerId,
          exerciseIndex: stored.exerciseIndex,
          roundNumber: stored.exerciseState.visit,
          valueJson: applied.visitValue as Prisma.InputJsonValue,
          calculatedScore: applied.calculatedScore,
          audits: { create: { action: "CREATED", afterJson: applied.visitValue as Prisma.InputJsonValue } },
        },
      });
      const updated = await tx.homeTrainingSession.update({
        where: { id: session.id },
        data: completed
          ? { status: HomeSessionStatus.COMPLETED, completedAt: new Date(), stateJson: nextState as Prisma.InputJsonValue }
          : { exerciseIndex: nextExerciseIndex, stateJson: nextState as Prisma.InputJsonValue },
      });
      return { created, updated };
    });

    return NextResponse.json({ result: result.created, session: result.updated, state: nextState, exerciseCompleted, completed });
  } catch (error) {
    console.error("Home training session POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Heimtraining konnte nicht gespeichert werden." }, { status: 500 });
  }
}
