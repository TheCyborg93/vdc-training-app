import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [plans, players, boards, trainingDays] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { status: { in: ["DRAFT", "PUBLISHED"] } },
        orderBy: { updatedAt: "desc" },
        include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } },
      }),
      prisma.player.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
      prisma.board.findMany({ where: { active: true, available: true }, orderBy: { name: "asc" } }),
      prisma.trainingDay.findMany({
        orderBy: { trainingDate: "desc" },
        take: 10,
        include: {
          trainingPlan: true,
          boards: { include: { board: true } },
          players: { include: { player: true } },
          assignments: { orderBy: [{ boardId: "asc" }, { position: "asc" }], include: { board: true, player: true } },
        },
      }),
    ]);

    return NextResponse.json({ plans, players, boards, trainingDays });
  } catch (error) {
    console.error("Training day GET failed", error);
    return NextResponse.json({ error: "Daten für den Trainingstag konnten nicht geladen werden." }, { status: 500 });
  }
}

type AssignmentInput = { boardId?: unknown; playerId?: unknown; position?: unknown };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trainingPlanId = Number(body.trainingPlanId);
    const trainingDate = new Date(String(body.trainingDate ?? ""));
    const boardIds = Array.isArray(body.boardIds) ? [...new Set(body.boardIds.map(Number))] : [];
    const playerIds = Array.isArray(body.playerIds) ? [...new Set(body.playerIds.map(Number))] : [];
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];

    if (!Number.isInteger(trainingPlanId) || Number.isNaN(trainingDate.getTime()) || boardIds.length === 0 || playerIds.length === 0) {
      return NextResponse.json({ error: "Trainingsplan, Datum, mindestens ein Board und mindestens ein Spieler sind erforderlich." }, { status: 400 });
    }

    const normalizedAssignments = assignments.map((item: AssignmentInput) => ({
      boardId: Number(item.boardId),
      playerId: Number(item.playerId),
      position: Number(item.position),
    }));

    const assignedPlayers = new Set(normalizedAssignments.map((item: { playerId: number }) => item.playerId));
    const valid = normalizedAssignments.length === playerIds.length &&
      assignedPlayers.size === playerIds.length &&
      normalizedAssignments.every((item: { boardId: number; playerId: number; position: number }) =>
        boardIds.includes(item.boardId) && playerIds.includes(item.playerId) && Number.isInteger(item.position) && item.position > 0
      );

    if (!valid) {
      return NextResponse.json({ error: "Die Board-Verteilung ist unvollständig oder ungültig." }, { status: 400 });
    }

    const trainingDay = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingDay.create({
        data: {
          trainingPlanId,
          trainingDate,
          status: "PUBLISHED",
          publishedAt: new Date(),
          boards: { create: boardIds.map((boardId) => ({ boardId })) },
          players: { create: playerIds.map((playerId) => ({ playerId })) },
          assignments: { create: normalizedAssignments },
          sessions: { create: boardIds.map((boardId) => ({ boardId, status: "NOT_STARTED" })) },
        },
        include: { trainingPlan: true, assignments: { include: { board: true, player: true } } },
      });

      await tx.trainingPlan.update({ where: { id: trainingPlanId }, data: { status: "PUBLISHED" } });
      return created;
    });

    return NextResponse.json(trainingDay, { status: 201 });
  } catch (error) {
    console.error("Training day POST failed", error);
    return NextResponse.json({ error: "Trainingstag konnte nicht veröffentlicht werden." }, { status: 500 });
  }
}
