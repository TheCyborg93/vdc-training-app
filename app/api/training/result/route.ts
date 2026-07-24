import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeExerciseResult } from "@/lib/exercise-engine";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

type ProgressState = { order: number[]; exerciseIndex: number; playerIndex: number; roundNumber: number };

function readProgress(value: unknown): ProgressState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];
  const exerciseIndex = Number(data.exerciseIndex);
  const playerIndex = Number(data.playerIndex);
  const roundNumber = Number(data.roundNumber);
  if (!order.length || !Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const boardSessionId = Number(body.boardSessionId);
    if (!Number.isInteger(boardSessionId) || body.value == null) {
      return NextResponse.json({ error: "Board-Sitzung und Ergebnis sind erforderlich." }, { status: 400 });
    }

    const session = await prisma.boardSession.findUnique({
      where: { id: boardSessionId },
      include: { trainingDay: { include: { trainingPlan: { include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } } },
    });
    if (!session || session.status !== "RUNNING") return NextResponse.json({ error: "Diese Board-Sitzung läuft aktuell nicht." }, { status: 409 });

    const assignments = await prisma.boardAssignment.findMany({ where: { trainingDayId: session.trainingDayId, boardId: session.boardId }, orderBy: { position: "asc" } });
    const progress = readProgress(session.randomOrderJson);
    if (!progress) return NextResponse.json({ error: "Der Trainingsfortschritt ist ungültig." }, { status: 409 });

    const planExercises = session.trainingDay.trainingPlan.exercises;
    const currentPlanExercise = planExercises[progress.exerciseIndex];
    const currentPlayerId = progress.order[progress.playerIndex];
    if (!currentPlanExercise || !currentPlayerId) return NextResponse.json({ error: "Aktuelle Übung oder Spieler konnte nicht bestimmt werden." }, { status: 409 });

    let normalized;
    try {
      normalized = normalizeExerciseResult(currentPlanExercise.exercise.resultType, body.value);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültiges Ergebnis." }, { status: 400 });
    }

    let nextPlayerIndex = progress.playerIndex + 1;
    let nextExerciseIndex = progress.exerciseIndex;
    let nextOrder = progress.order;
    let completed = false;
    if (nextPlayerIndex >= progress.order.length) {
      nextPlayerIndex = 0;
      nextExerciseIndex += 1;
      nextOrder = shuffle(assignments.map((item) => item.playerId));
      if (nextExerciseIndex >= planExercises.length) completed = true;
    }

    const nextExercise = completed ? null : planExercises[nextExerciseIndex];
    const nextProgress = completed ? progress : { order: nextOrder, exerciseIndex: nextExerciseIndex, playerIndex: nextPlayerIndex, roundNumber: progress.roundNumber + 1 };

    await prisma.$transaction(async (tx) => {
      await tx.exerciseResult.create({
        data: {
          boardSession: { connect: { id: session.id } },
          exercise: { connect: { id: currentPlanExercise.exerciseId } },
          player: { connect: { id: currentPlayerId } },
          roundNumber: progress.roundNumber,
          valueJson: normalized.value as Prisma.InputJsonValue,
          calculatedScore: normalized.calculatedScore,
        },
      });
      await tx.boardSession.update({
        where: { id: session.id },
        data: completed ? { status: "COMPLETED", completedAt: new Date(), currentExerciseId: null } : { currentExerciseId: nextExercise?.exerciseId ?? null, randomOrderJson: nextProgress },
      });
      if (completed) {
        const openSessions = await tx.boardSession.count({ where: { trainingDayId: session.trainingDayId, status: { not: "COMPLETED" } } });
        if (openSessions === 0) await tx.trainingDay.update({ where: { id: session.trainingDayId }, data: { status: "COMPLETED" } });
      }
    });

    return NextResponse.json({ completed, nextProgress, result: normalized });
  } catch (error) {
    console.error("Training result POST failed", error);
    return NextResponse.json({ error: "Das Ergebnis konnte nicht gespeichert werden." }, { status: 500 });
  }
}
