import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const boardId = Number(body.boardId);

    if (!Number.isInteger(trainingDayId) || !Number.isInteger(boardId)) {
      return NextResponse.json({ error: "Trainingstag und Board sind erforderlich." }, { status: 400 });
    }

    const [assignments, trainingDay] = await Promise.all([
      prisma.boardAssignment.findMany({
        where: { trainingDayId, boardId },
        orderBy: { position: "asc" },
        include: { player: true },
      }),
      prisma.trainingDay.findUnique({
        where: { id: trainingDayId },
        include: { trainingPlan: { include: { exercises: { orderBy: { position: "asc" } } } } },
      }),
    ]);

    if (assignments.length === 0) {
      return NextResponse.json({ error: "Für dieses Board wurden keine Spieler eingeteilt." }, { status: 404 });
    }
    const firstExercise = trainingDay?.trainingPlan.exercises[0];
    if (!firstExercise) {
      return NextResponse.json({ error: "Der Trainingsplan enthält keine Übungen." }, { status: 400 });
    }

    const order = shuffle(assignments.map((assignment) => assignment.playerId));
    const progress = { order, exerciseIndex: 0, playerIndex: 0, roundNumber: 1 };

    const session = await prisma.$transaction(async (tx) => {
      const updated = await tx.boardSession.update({
        where: { trainingDayId_boardId: { trainingDayId, boardId } },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          currentExerciseId: firstExercise.exerciseId,
          randomOrderJson: progress,
        },
        include: { board: true },
      });

      await tx.trainingDay.update({ where: { id: trainingDayId }, data: { status: "RUNNING" } });
      return updated;
    });

    return NextResponse.json({ session, progress, players: assignments.map((item) => item.player) });
  } catch (error) {
    console.error("Training start POST failed", error);
    return NextResponse.json({ error: "Das Training konnte nicht gestartet werden." }, { status: 500 });
  }
}
