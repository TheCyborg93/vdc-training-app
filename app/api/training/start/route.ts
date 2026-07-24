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

    const assignments = await prisma.boardAssignment.findMany({
      where: { trainingDayId, boardId },
      orderBy: { position: "asc" },
      include: { player: true },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ error: "Für dieses Board wurden keine Spieler eingeteilt." }, { status: 404 });
    }

    const randomOrder = shuffle(assignments.map((assignment) => assignment.playerId));

    const session = await prisma.$transaction(async (tx) => {
      const updated = await tx.boardSession.update({
        where: { trainingDayId_boardId: { trainingDayId, boardId } },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          randomOrderJson: randomOrder,
        },
        include: { board: true },
      });

      await tx.trainingDay.update({
        where: { id: trainingDayId },
        data: { status: "RUNNING" },
      });

      return updated;
    });

    return NextResponse.json({ session, randomOrder, players: assignments.map((item) => item.player) });
  } catch (error) {
    console.error("Training start POST failed", error);
    return NextResponse.json({ error: "Das Training konnte nicht gestartet werden." }, { status: 500 });
  }
}
