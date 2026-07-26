import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyVisit, createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";
import { buildTrainingReport } from "@/lib/training-report";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

type ProgressState = {
  order: number[];
  exerciseIndex: number;
  playerIndex: number;
  roundNumber: number;
  playerStates: Record<string, PlayerExerciseState>;
};

function readProgress(value: unknown): ProgressState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];
  const exerciseIndex = Number(data.exerciseIndex);
  const playerIndex = Number(data.playerIndex);
  const roundNumber = Number(data.roundNumber);
  const playerStates = data.playerStates && typeof data.playerStates === "object" && !Array.isArray(data.playerStates)
    ? data.playerStates as Record<string, PlayerExerciseState>
    : {};
  if (!order.length || !Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber, playerStates };
}

function nextActivePlayerIndex(order: number[], states: Record<string, PlayerExerciseState>, currentIndex: number): number {
  for (let offset = 1; offset <= order.length; offset += 1) {
    const index = (currentIndex + offset) % order.length;
    if (!states[String(order[index])]?.completed) return index;
  }
  return currentIndex;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const boardSessionId = Number(body.boardSessionId);
    const action = String(body.action ?? "visit");
    if (!Number.isInteger(boardSessionId)) return NextResponse.json({ error: "Board-Sitzung ist erforderlich." }, { status: 400 });

    const session = await prisma.boardSession.findUnique({
      where: { id: boardSessionId },
      include: { trainingDay: { include: { trainingPlan: { include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } } },
    });
    if (!session) return NextResponse.json({ error: "Board-Sitzung wurde nicht gefunden." }, { status: 404 });

    if (action === "undo") {
      const lastResult = await prisma.exerciseResult.findFirst({
        where: { boardSessionId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (!lastResult) return NextResponse.json({ error: "Es gibt keine Aufnahme zum Rückgängigmachen." }, { status: 404 });
      const value = lastResult.valueJson as Record<string, unknown>;
      const progressBefore = value.progressBefore;
      if (!progressBefore || typeof progressBefore !== "object" || Array.isArray(progressBefore) || !readProgress(progressBefore)) {
        return NextResponse.json({ error: "Diese ältere Aufnahme enthält noch keinen wiederherstellbaren Trainingsstand." }, { status: 409 });
      }
      const restored = readProgress(progressBefore)!;
      const restoredExercise = session.trainingDay.trainingPlan.exercises[restored.exerciseIndex];

      await prisma.$transaction(async (tx) => {
        await tx.resultAudit.create({
          data: {
            exerciseResultId: lastResult.id,
            action: "UNDONE",
            beforeJson: lastResult.valueJson as Prisma.InputJsonValue,
            reason: String(body.reason ?? "Letzte Aufnahme rückgängig"),
          },
        });
        await tx.exerciseResult.update({ where: { id: lastResult.id }, data: { deletedAt: new Date() } });
        await tx.boardSession.update({
          where: { id: boardSessionId },
          data: {
            status: "RUNNING",
            completedAt: null,
            currentExerciseId: restoredExercise?.exerciseId ?? null,
            randomOrderJson: restored as Prisma.InputJsonValue,
          },
        });
        if (session.trainingDay.status === "COMPLETED") {
          await tx.trainingDay.update({ where: { id: session.trainingDayId }, data: { status: "RUNNING" } });
        }
      });

      return NextResponse.json({ restoredProgress: restored, undoneResultId: lastResult.id });
    }

    if (session.status !== "RUNNING") return NextResponse.json({ error: "Diese Board-Sitzung läuft aktuell nicht." }, { status: 409 });
    if (!body.value || typeof body.value !== "object") return NextResponse.json({ error: "Eine Aufnahme ist erforderlich." }, { status: 400 });

    const assignments = await prisma.boardAssignment.findMany({
      where: { trainingDayId: session.trainingDayId, boardId: session.boardId },
      orderBy: { position: "asc" },
      include: { player: { select: { id: true, displayName: true } } },
    });
    const progress = readProgress(session.randomOrderJson);
    if (!progress) return NextResponse.json({ error: "Der Trainingsfortschritt ist ungültig." }, { status: 409 });

    const planExercises = session.trainingDay.trainingPlan.exercises;
    const currentPlanExercise = planExercises[progress.exerciseIndex];
    const currentPlayerId = progress.order[progress.playerIndex];
    if (!currentPlanExercise || !currentPlayerId) return NextResponse.json({ error: "Aktuelle Übung oder Spieler konnte nicht bestimmt werden." }, { status: 409 });

    const currentState = progress.playerStates[String(currentPlayerId)] ?? createInitialExerciseState(currentPlanExercise.exercise);
    if (currentState.completed) return NextResponse.json({ error: "Dieser Spieler hat die Übung bereits abgeschlossen." }, { status: 409 });

    const applied = applyVisit(currentPlanExercise.exercise, currentState, body.value as Record<string, unknown>);
    const updatedStates = { ...progress.playerStates, [String(currentPlayerId)]: applied.nextState };
    const allPlayersFinished = progress.order.every((playerId) => Boolean(updatedStates[String(playerId)]?.completed));

    let completed = false;
    let exerciseCompleted = false;
    let nextExerciseIndex = progress.exerciseIndex;
    let nextOrder = progress.order;
    let nextPlayerIndex = progress.playerIndex;
    let finalStates = updatedStates;

    if (allPlayersFinished) {
      exerciseCompleted = true;
      nextExerciseIndex += 1;
      if (nextExerciseIndex >= planExercises.length) {
        completed = true;
      } else {
        nextOrder = shuffle(assignments.map((item) => item.playerId));
        const upcomingExercise = planExercises[nextExerciseIndex].exercise;
        finalStates = Object.fromEntries(nextOrder.map((playerId) => [String(playerId), createInitialExerciseState(upcomingExercise)]));
        nextPlayerIndex = 0;
      }
    } else {
      nextPlayerIndex = nextActivePlayerIndex(progress.order, updatedStates, progress.playerIndex);
    }

    const nextProgress: ProgressState = {
      order: nextOrder,
      exerciseIndex: completed ? progress.exerciseIndex : nextExerciseIndex,
      playerIndex: completed ? progress.playerIndex : nextPlayerIndex,
      roundNumber: progress.roundNumber + 1,
      playerStates: finalStates,
    };
    const nextExercise = completed ? null : planExercises[nextExerciseIndex];
    const nextPlayerId = completed ? null : nextOrder[nextPlayerIndex];
    const storedValue = { ...applied.visitValue, progressBefore: progress } as Prisma.InputJsonValue;
    const completedAt = completed ? new Date() : null;
    const nextProgressJson = nextProgress as Prisma.InputJsonValue;

    await prisma.$transaction(async (tx) => {
      await tx.exerciseResult.create({
        data: {
          boardSession: { connect: { id: session.id } },
          exercise: { connect: { id: currentPlanExercise.exerciseId } },
          player: { connect: { id: currentPlayerId } },
          roundNumber: currentState.visit,
          valueJson: storedValue,
          calculatedScore: applied.calculatedScore,
          audits: { create: { action: "CREATED", afterJson: storedValue } },
        },
      });
      await tx.boardSession.update({
        where: { id: session.id },
        data: completed
          ? { status: "COMPLETED", completedAt, currentExerciseId: null, randomOrderJson: nextProgressJson }
          : { currentExerciseId: nextExercise?.exerciseId ?? currentPlanExercise.exerciseId, randomOrderJson: nextProgressJson },
      });
      if (completed) {
        const openSessions = await tx.boardSession.count({ where: { trainingDayId: session.trainingDayId, status: { not: "COMPLETED" } } });
        if (openSessions === 0) await tx.trainingDay.update({ where: { id: session.trainingDayId }, data: { status: "COMPLETED" } });
      }
    });

    let report = null;
    if (completed) {
      const allResults = await prisma.exerciseResult.findMany({
        where: { boardSessionId: session.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { exerciseId: true, playerId: true, roundNumber: true, calculatedScore: true, valueJson: true },
      });
      report = buildTrainingReport({
        title: session.trainingDay.trainingPlan.title,
        completedAt,
        exercises: planExercises.map((item) => ({ exercise: item.exercise, position: item.position })),
        players: assignments.map((item) => item.player),
        results: allResults,
      });
    }

    return NextResponse.json({
      completed,
      exerciseCompleted,
      playerFinished: applied.playerFinished,
      nextPlayerId,
      nextProgress,
      state: applied.nextState,
      report,
    });
  } catch (error) {
    console.error("Training result POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Die Aufnahme konnte nicht gespeichert werden." }, { status: 500 });
  }
}
