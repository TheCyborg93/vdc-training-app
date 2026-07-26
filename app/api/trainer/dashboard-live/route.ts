import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

export async function GET() {
  try {
    const [training, results] = await Promise.all([
      prisma.trainingDay.findFirst({
        where: { status: { in: ["PUBLISHED", "RUNNING"] } },
        orderBy: { trainingDate: "asc" },
        select: {
          id: true,
          boards: { select: { boardId: true, board: { select: { name: true } } } },
          sessions: {
            select: { boardId: true, status: true, currentExerciseId: true },
          },
          trainingPlan: {
            select: {
              exercises: {
                select: { exerciseId: true, exercise: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.exerciseResult.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          calculatedScore: true,
          createdAt: true,
          player: { select: { displayName: true } },
          exercise: { select: { name: true } },
        },
      }),
    ]);

    const exerciseNames = new Map(
      training?.trainingPlan.exercises.map((item) => [item.exerciseId, item.exercise.name]) ?? [],
    );

    const boards = training?.boards.map((entry) => {
      const session = training.sessions.find((item) => item.boardId === entry.boardId);
      return {
        boardId: entry.boardId,
        name: entry.board.name,
        status: session?.status ?? "NOT_STARTED",
        exerciseName: session?.currentExerciseId ? exerciseNames.get(session.currentExerciseId) ?? null : null,
      };
    }) ?? [];

    return NextResponse.json(
      {
        trainingId: training?.id ?? null,
        boards,
        runningBoards: boards.filter((board) => board.status === "RUNNING").length,
        occupiedBoards: boards.filter((board) => ["RUNNING", "PAUSED"].includes(board.status)).length,
        completedBoards: boards.filter((board) => board.status === "COMPLETED").length,
        results: results.map((item) => ({
          id: item.id,
          playerName: item.player.displayName,
          exerciseName: item.exercise.name,
          calculatedScore: item.calculatedScore,
          createdAt: item.createdAt.toISOString(),
        })),
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Dashboard live GET failed", error);
    return NextResponse.json({ error: "Live-Daten konnten nicht geladen werden." }, { status: 500 });
  }
}
