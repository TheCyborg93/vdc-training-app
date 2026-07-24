import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";

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

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function nextActiveIndex(progress: ProgressState): number {
  for (let offset = 1; offset <= progress.order.length; offset += 1) {
    const index = (progress.playerIndex + offset) % progress.order.length;
    if (!progress.playerStates[String(progress.order[index])]?.completed) return index;
  }
  return progress.playerIndex;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const boardSessionId = Number(body.boardSessionId);
    const action = String(body.action ?? "");
    if (!Number.isInteger(boardSessionId)) return NextResponse.json({ error: "Board-Sitzung ist erforderlich." }, { status: 400 });

    const session = await prisma.boardSession.findUnique({
      where: { id: boardSessionId },
      include: {
        trainingDay: {
          include: {
            trainingPlan: { include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } } },
          },
        },
      },
    });
    if (!session) return NextResponse.json({ error: "Board-Sitzung wurde nicht gefunden." }, { status: 404 });

    const assignments = await prisma.boardAssignment.findMany({
      where: { trainingDayId: session.trainingDayId, boardId: session.boardId },
      orderBy: { position: "asc" },
    });
    const validPlayerIds = assignments.map((item) => item.playerId);
    const progress = readProgress(session.randomOrderJson);

    if (action === "pause") {
      if (session.status !== "RUNNING") return NextResponse.json({ error: "Nur ein laufendes Board kann pausiert werden." }, { status: 409 });
      const updated = await prisma.boardSession.update({ where: { id: session.id }, data: { status: "PAUSED" } });
      return NextResponse.json({ session: updated, message: "Board pausiert." });
    }

    if (action === "resume") {
      if (session.status !== "PAUSED") return NextResponse.json({ error: "Dieses Board ist nicht pausiert." }, { status: 409 });
      const updated = await prisma.$transaction(async (tx) => {
        const board = await tx.boardSession.update({ where: { id: session.id }, data: { status: "RUNNING" } });
        if (session.trainingDay.status !== "RUNNING") await tx.trainingDay.update({ where: { id: session.trainingDayId }, data: { status: "RUNNING" } });
        return board;
      });
      return NextResponse.json({ session: updated, message: "Board fortgesetzt." });
    }

    if (!progress) return NextResponse.json({ error: "Das Board wurde noch nicht gestartet oder der Fortschritt ist ungültig." }, { status: 409 });
    if (session.status !== "RUNNING" && action !== "reorder") return NextResponse.json({ error: "Das Board muss für diese Aktion laufen." }, { status: 409 });

    if (action === "skip") {
      const nextIndex = nextActiveIndex(progress);
      const updatedProgress = { ...progress, playerIndex: nextIndex };
      await prisma.boardSession.update({ where: { id: session.id }, data: { randomOrderJson: updatedProgress as Prisma.InputJsonValue } });
      return NextResponse.json({ progress: updatedProgress, nextPlayerId: updatedProgress.order[nextIndex], message: "Spieler übersprungen." });
    }

    if (action === "reorder") {
      const requested = Array.isArray(body.order) ? body.order.map(Number).filter(Number.isInteger) : [];
      if (requested.length !== validPlayerIds.length || new Set(requested).size !== requested.length || requested.some((id) => !validPlayerIds.includes(id))) {
        return NextResponse.json({ error: "Die neue Reihenfolge muss alle Spieler des Boards genau einmal enthalten." }, { status: 400 });
      }
      const currentPlayerId = progress.order[progress.playerIndex];
      const currentIndex = Math.max(0, requested.indexOf(currentPlayerId));
      const updatedProgress = { ...progress, order: requested, playerIndex: currentIndex };
      await prisma.boardSession.update({ where: { id: session.id }, data: { randomOrderJson: updatedProgress as Prisma.InputJsonValue } });
      return NextResponse.json({ progress: updatedProgress, message: "Reihenfolge aktualisiert." });
    }

    if (action === "finish_exercise") {
      const exercises = session.trainingDay.trainingPlan.exercises;
      const nextExerciseIndex = progress.exerciseIndex + 1;
      const completed = nextExerciseIndex >= exercises.length;

      await prisma.$transaction(async (tx) => {
        if (completed) {
          await tx.boardSession.update({
            where: { id: session.id },
            data: { status: "COMPLETED", completedAt: new Date(), currentExerciseId: null, randomOrderJson: progress as Prisma.InputJsonValue },
          });
          const openBoards = await tx.boardSession.count({ where: { trainingDayId: session.trainingDayId, id: { not: session.id }, status: { not: "COMPLETED" } } });
          if (openBoards === 0) await tx.trainingDay.update({ where: { id: session.trainingDayId }, data: { status: "COMPLETED" } });
          return;
        }

        const order = shuffle(validPlayerIds);
        const exercise = exercises[nextExerciseIndex].exercise;
        const playerStates = Object.fromEntries(order.map((playerId) => [String(playerId), createInitialExerciseState(exercise)]));
        const nextProgress: ProgressState = { order, exerciseIndex: nextExerciseIndex, playerIndex: 0, roundNumber: progress.roundNumber + 1, playerStates };
        await tx.boardSession.update({
          where: { id: session.id },
          data: { currentExerciseId: exercise.id, randomOrderJson: nextProgress as Prisma.InputJsonValue },
        });
      });

      return NextResponse.json({ completed, message: completed ? "Board-Training abgeschlossen." : "Übung beendet. Nächste Übung wurde gestartet." });
    }

    return NextResponse.json({ error: "Unbekannte Traineraktion." }, { status: 400 });
  } catch (error) {
    console.error("Trainer live control failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Traineraktion konnte nicht ausgeführt werden." }, { status: 500 });
  }
}
