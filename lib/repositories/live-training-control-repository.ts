import {
  BoardSessionStatus,
  Prisma,
  TrainingDayStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findBoardSessionForControl(boardSessionId: number) {
  return prisma.boardSession.findUnique({
    where: { id: boardSessionId },
    include: {
      trainingDay: {
        include: {
          trainingPlan: {
            include: {
              exercises: {
                orderBy: { position: "asc" },
                include: { exercise: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function findBoardAssignments(trainingDayId: number, boardId: number) {
  return prisma.boardAssignment.findMany({
    where: { trainingDayId, boardId },
    orderBy: { position: "asc" },
    select: { playerId: true },
  });
}

export async function updateBoardStatus(
  boardSessionId: number,
  status: BoardSessionStatus.RUNNING | BoardSessionStatus.PAUSED,
) {
  return prisma.boardSession.update({
    where: { id: boardSessionId },
    data: { status },
  });
}

export async function resumeBoardAndTraining(
  boardSessionId: number,
  trainingDayId: number,
  trainingDayStatus: TrainingDayStatus,
) {
  return prisma.$transaction(async (tx) => {
    const board = await tx.boardSession.update({
      where: { id: boardSessionId },
      data: { status: BoardSessionStatus.RUNNING },
    });
    if (trainingDayStatus !== TrainingDayStatus.RUNNING) {
      await tx.trainingDay.update({
        where: { id: trainingDayId },
        data: { status: TrainingDayStatus.RUNNING },
      });
    }
    return board;
  });
}

export async function updateBoardProgress(boardSessionId: number, progress: unknown) {
  return prisma.boardSession.update({
    where: { id: boardSessionId },
    data: { randomOrderJson: progress as Prisma.InputJsonValue },
  });
}

export async function advanceBoardExercise(
  boardSessionId: number,
  status: BoardSessionStatus,
  exerciseId: number,
  progress: unknown,
) {
  return prisma.boardSession.update({
    where: { id: boardSessionId },
    data: {
      status,
      currentExerciseId: exerciseId,
      randomOrderJson: progress as Prisma.InputJsonValue,
    },
  });
}

export async function completeBoardSession(input: {
  boardSessionId: number;
  trainingDayId: number;
  progress: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.boardSession.update({
      where: { id: input.boardSessionId },
      data: {
        status: BoardSessionStatus.COMPLETED,
        completedAt: new Date(),
        currentExerciseId: null,
        randomOrderJson: input.progress as Prisma.InputJsonValue,
      },
    });

    const openBoards = await tx.boardSession.count({
      where: {
        trainingDayId: input.trainingDayId,
        id: { not: input.boardSessionId },
        status: { not: BoardSessionStatus.COMPLETED },
      },
    });

    if (openBoards === 0) {
      await tx.trainingDay.update({
        where: { id: input.trainingDayId },
        data: { status: TrainingDayStatus.COMPLETED },
      });
    }

    return { trainingCompleted: openBoards === 0 };
  });
}

export type BoardSessionForControl = NonNullable<
  Awaited<ReturnType<typeof findBoardSessionForControl>>
>;
