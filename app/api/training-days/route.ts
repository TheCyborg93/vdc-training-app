import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AssignmentInput = { boardId?: unknown; playerId?: unknown; position?: unknown };
type NormalizedAssignment = { boardId: number; playerId: number; position: number };

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((item): item is number => Number.isInteger(item) && item > 0))];
}

function normalizeAssignments(value: unknown): NormalizedAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: AssignmentInput) => ({
    boardId: Number(item.boardId),
    playerId: Number(item.playerId),
    position: Number(item.position),
  }));
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trainingPlanId = Number(body.trainingPlanId);
    const trainingDate = new Date(String(body.trainingDate ?? ""));
    const boardIds = normalizeIds(body.boardIds);
    const playerIds = normalizeIds(body.playerIds);
    const normalizedAssignments = normalizeAssignments(body.assignments);

    if (!Number.isInteger(trainingPlanId) || trainingPlanId < 1 || Number.isNaN(trainingDate.getTime()) || !boardIds.length || !playerIds.length) {
      return NextResponse.json({ error: "Trainingsplan, Datum, mindestens ein Board und mindestens ein Spieler sind erforderlich." }, { status: 400 });
    }

    const assignedPlayers = new Set(normalizedAssignments.map((item) => item.playerId));
    const uniqueBoardPositions = new Set(normalizedAssignments.map((item) => `${item.boardId}:${item.position}`));
    const validAssignments =
      normalizedAssignments.length === playerIds.length &&
      assignedPlayers.size === playerIds.length &&
      uniqueBoardPositions.size === normalizedAssignments.length &&
      normalizedAssignments.every((item) =>
        Number.isInteger(item.boardId) && Number.isInteger(item.playerId) && Number.isInteger(item.position) &&
        item.position > 0 && boardIds.includes(item.boardId) && playerIds.includes(item.playerId),
      );

    if (!validAssignments) {
      return NextResponse.json({ error: "Die Board-Verteilung ist unvollständig oder ungültig. Bitte Spieler erneut automatisch verteilen." }, { status: 400 });
    }

    const [plan, boards, players] = await Promise.all([
      prisma.trainingPlan.findFirst({ where: { id: trainingPlanId, status: { in: ["DRAFT", "PUBLISHED"] } }, select: { id: true } }),
      prisma.board.findMany({ where: { id: { in: boardIds }, active: true, available: true }, select: { id: true } }),
      prisma.player.findMany({ where: { id: { in: playerIds }, active: true }, select: { id: true } }),
    ]);

    if (!plan || boards.length !== boardIds.length || players.length !== playerIds.length) {
      return NextResponse.json({ error: "Mindestens ein ausgewählter Datensatz ist nicht mehr verfügbar. Bitte Seite neu laden." }, { status: 409 });
    }

    const trainingDayId = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingDay.create({
        data: { trainingPlanId, trainingDate, status: "PUBLISHED", publishedAt: new Date() },
        select: { id: true },
      });

      await tx.trainingDayBoard.createMany({
        data: boardIds.map((boardId) => ({ trainingDayId: created.id, boardId })),
      });
      await tx.trainingDayPlayer.createMany({
        data: playerIds.map((playerId) => ({ trainingDayId: created.id, playerId })),
      });
      await tx.boardAssignment.createMany({
        data: normalizedAssignments.map((item) => ({ trainingDayId: created.id, ...item })),
      });
      await tx.boardSession.createMany({
        data: boardIds.map((boardId) => ({ trainingDayId: created.id, boardId, status: "NOT_STARTED" })),
      });
      await tx.trainingPlan.update({ where: { id: trainingPlanId }, data: { status: "PUBLISHED" } });

      return created.id;
    }, { timeout: 15000 });

    const trainingDay = await prisma.trainingDay.findUnique({
      where: { id: trainingDayId },
      include: {
        trainingPlan: true,
        boards: { include: { board: true } },
        players: { include: { player: true } },
        assignments: { orderBy: [{ boardId: "asc" }, { position: "asc" }], include: { board: true, player: true } },
        sessions: { include: { board: true } },
      },
    });

    return NextResponse.json(trainingDay, { status: 201 });
  } catch (error) {
    console.error("Training day POST failed", error);
    const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
    return NextResponse.json({ error: `Trainingstag konnte nicht veröffentlicht werden: ${message}` }, { status: 500 });
  }
}
