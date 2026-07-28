import { prisma } from "@/lib/prisma";
import type { PublishTrainingDayInput } from "@/lib/validators/training-day";

const trainingDayInclude = {
  trainingPlan: true,
  boards: { include: { board: true } },
  players: { include: { player: true } },
  assignments: {
    orderBy: [{ boardId: "asc" as const }, { position: "asc" as const }],
    include: { board: true, player: true },
  },
  sessions: { include: { board: true } },
};

export async function loadTrainingDayWorkspace() {
  return Promise.all([
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
        assignments: {
          orderBy: [{ boardId: "asc" }, { position: "asc" }],
          include: { board: true, player: true },
        },
      },
    }),
  ]);
}

export async function validateTrainingDayResources(input: PublishTrainingDayInput) {
  return Promise.all([
    prisma.trainingPlan.findFirst({
      where: { id: input.trainingPlanId, status: { in: ["DRAFT", "PUBLISHED"] } },
      select: { id: true },
    }),
    prisma.board.findMany({
      where: { id: { in: input.boardIds }, active: true, available: true },
      select: { id: true },
    }),
    prisma.player.findMany({
      where: { id: { in: input.playerIds }, active: true },
      select: { id: true },
    }),
  ]);
}

export async function createPublishedTrainingDay(input: PublishTrainingDayInput) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.trainingDay.create({
      data: {
        trainingPlanId: input.trainingPlanId,
        trainingDate: input.trainingDate,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    await Promise.all([
      tx.trainingDayBoard.createMany({
        data: input.boardIds.map((boardId) => ({ trainingDayId: created.id, boardId })),
      }),
      tx.trainingDayPlayer.createMany({
        data: input.playerIds.map((playerId) => ({ trainingDayId: created.id, playerId })),
      }),
      tx.boardAssignment.createMany({
        data: input.assignments.map((assignment) => ({ trainingDayId: created.id, ...assignment })),
      }),
      tx.boardSession.createMany({
        data: input.boardIds.map((boardId) => ({ trainingDayId: created.id, boardId, status: "NOT_STARTED" })),
      }),
      tx.trainingPlan.update({
        where: { id: input.trainingPlanId },
        data: { status: "PUBLISHED" },
      }),
    ]);

    return created.id;
  }, { timeout: 15000 });
}

export async function findTrainingDayById(trainingDayId: number) {
  return prisma.trainingDay.findUnique({
    where: { id: trainingDayId },
    include: trainingDayInclude,
  });
}

export type TrainingDayDetail = NonNullable<Awaited<ReturnType<typeof findTrainingDayById>>>;
