import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AssignmentInput = {
  boardId?: unknown;
  playerId?: unknown;
  position?: unknown;
};

type NormalizedAssignment = {
  boardId: number;
  playerId: number;
  position: number;
};

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item): item is number => Number.isInteger(item) && item > 0),
  )];
}

export async function GET() {
  try {
    const [plans, players, boards, trainingDays] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { status: { in: ["DRAFT", "PUBLISHED"] } },
        orderBy: { updatedAt: "desc" },
        include: {
          exercises: {
            orderBy: { position: "asc" },
            include: { exercise: true },
          },
        },
      }),
      prisma.player.findMany({
        where: { active: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.board.findMany({
        where: { active: true, available: true },
        orderBy: { name: "asc" },
      }),
      prisma.trainingDay.findMany({
        orderBy: { trainingDate: "desc" },
        take: 10,
        include: {
          trainingPlan: true,
          boards: { include: { board: true } },
          players: { include: { player: true } },
          assignments: {
            orderBy: [{ boardId: "asc" }, { position: "asc" }],
            include: { board: true, player: true },
          },
        },
      }),
    ]);

    return NextResponse.json({ plans, players, boards, trainingDays });
  } catch (error) {
    console.error("Training day GET failed", error);
    return NextResponse.json(
      { error: "Daten für den Trainingstag konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trainingPlanId = Number(body.trainingPlanId);
    const trainingDate = new Date(String(body.trainingDate ?? ""));
    const boardIds = normalizeIds(body.boardIds);
    const playerIds = normalizeIds(body.playerIds);
    const assignmentsInput: AssignmentInput[] = Array.isArray(body.assignments)
      ? body.assignments
      : [];

    if (
      !Number.isInteger(trainingPlanId) ||
      trainingPlanId < 1 ||
      Number.isNaN(trainingDate.getTime()) ||
      boardIds.length === 0 ||
      playerIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Trainingsplan, Datum, mindestens ein Board und mindestens ein Spieler sind erforderlich.",
        },
        { status: 400 },
      );
    }

    const normalizedAssignments: NormalizedAssignment[] = assignmentsInput.map(
      (item) => ({
        boardId: Number(item.boardId),
        playerId: Number(item.playerId),
        position: Number(item.position),
      }),
    );

    const assignedPlayers = new Set(
      normalizedAssignments.map((item) => item.playerId),
    );

    const uniqueBoardPositions = new Set(
      normalizedAssignments.map((item) => `${item.boardId}:${item.position}`),
    );

    const validAssignments =
      normalizedAssignments.length === playerIds.length &&
      assignedPlayers.size === playerIds.length &&
      uniqueBoardPositions.size === normalizedAssignments.length &&
      normalizedAssignments.every(
        (item) =>
          Number.isInteger(item.boardId) &&
          Number.isInteger(item.playerId) &&
          Number.isInteger(item.position) &&
          item.position > 0 &&
          boardIds.includes(item.boardId) &&
          playerIds.includes(item.playerId),
      );

    if (!validAssignments) {
      return NextResponse.json(
        { error: "Die Board-Verteilung ist unvollständig oder ungültig." },
        { status: 400 },
      );
    }

    const [planCount, boardCount, playerCount] = await Promise.all([
      prisma.trainingPlan.count({
        where: { id: trainingPlanId, status: { in: ["DRAFT", "PUBLISHED"] } },
      }),
      prisma.board.count({
        where: { id: { in: boardIds }, active: true, available: true },
      }),
      prisma.player.count({
        where: { id: { in: playerIds }, active: true },
      }),
    ]);

    if (
      planCount !== 1 ||
      boardCount !== boardIds.length ||
      playerCount !== playerIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Mindestens ein ausgewählter Datensatz ist nicht mehr verfügbar. Bitte die Seite neu laden.",
        },
        { status: 409 },
      );
    }

    const trainingDay = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingDay.create({
        data: {
          trainingPlan: { connect: { id: trainingPlanId } },
          trainingDate,
          status: "PUBLISHED",
          publishedAt: new Date(),
          boards: {
            create: boardIds.map((boardId) => ({
              board: { connect: { id: boardId } },
            })),
          },
          players: {
            create: playerIds.map((playerId) => ({
              player: { connect: { id: playerId } },
            })),
          },
          assignments: {
            create: normalizedAssignments.map((assignment) => ({
              board: { connect: { id: assignment.boardId } },
              player: { connect: { id: assignment.playerId } },
              position: assignment.position,
            })),
          },
          sessions: {
            create: boardIds.map((boardId) => ({
              board: { connect: { id: boardId } },
              status: "NOT_STARTED",
            })),
          },
        },
        include: {
          trainingPlan: true,
          boards: { include: { board: true } },
          players: { include: { player: true } },
          assignments: {
            orderBy: [{ boardId: "asc" }, { position: "asc" }],
            include: { board: true, player: true },
          },
          sessions: { include: { board: true } },
        },
      });

      await tx.trainingPlan.update({
        where: { id: trainingPlanId },
        data: { status: "PUBLISHED" },
      });

      return created;
    });

    return NextResponse.json(trainingDay, { status: 201 });
  } catch (error) {
    console.error("Training day POST failed", error);
    return NextResponse.json(
      { error: "Trainingstag konnte nicht veröffentlicht werden." },
      { status: 500 },
    );
  }
}
