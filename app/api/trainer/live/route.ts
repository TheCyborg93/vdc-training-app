import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ProgressState = {
  order: number[];
  exerciseIndex: number;
  playerIndex: number;
  roundNumber: number;
};

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

export async function GET() {
  try {
    const trainingDay = await prisma.trainingDay.findFirst({
      where: { status: { in: ["PUBLISHED", "RUNNING"] } },
      orderBy: [{ trainingDate: "asc" }, { createdAt: "desc" }],
      include: {
        trainingPlan: {
          include: {
            exercises: {
              orderBy: { position: "asc" },
              include: { exercise: true },
            },
          },
        },
        assignments: {
          orderBy: [{ boardId: "asc" }, { position: "asc" }],
          include: { board: true, player: true },
        },
        sessions: {
          orderBy: { boardId: "asc" },
          include: {
            board: true,
            results: true,
          },
        },
      },
    });

    if (!trainingDay) return NextResponse.json(null);

    const boards = trainingDay.sessions.map((session) => {
      const progress = readProgress(session.randomOrderJson);
      const assignments = trainingDay.assignments.filter((item) => item.boardId === session.boardId);
      const playersById = new Map(assignments.map((item) => [item.playerId, item.player]));
      const orderedPlayers = progress
        ? progress.order.map((id) => playersById.get(id)).filter(Boolean)
        : assignments.map((item) => item.player);
      const currentPlayer = progress ? playersById.get(progress.order[progress.playerIndex]) ?? null : null;
      const currentPlanExercise = progress ? trainingDay.trainingPlan.exercises[progress.exerciseIndex] ?? null : null;
      const totalExercises = trainingDay.trainingPlan.exercises.length;
      const completedExercises = session.status === "COMPLETED" ? totalExercises : progress?.exerciseIndex ?? 0;
      const progressPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

      return {
        id: session.id,
        board: session.board,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        players: orderedPlayers,
        currentPlayer,
        currentExercise: currentPlanExercise?.exercise ?? null,
        exerciseIndex: progress?.exerciseIndex ?? 0,
        totalExercises,
        progressPercent: session.status === "COMPLETED" ? 100 : progressPercent,
        resultCount: session.results.length,
      };
    });

    return NextResponse.json({
      id: trainingDay.id,
      trainingDate: trainingDay.trainingDate,
      status: trainingDay.status,
      trainingPlan: {
        title: trainingDay.trainingPlan.title,
        goal: trainingDay.trainingPlan.goal,
        durationMin: trainingDay.trainingPlan.durationMin,
      },
      boards,
    });
  } catch (error) {
    console.error("Trainer live GET failed", error);
    return NextResponse.json({ error: "Live-Training konnte nicht geladen werden." }, { status: 500 });
  }
}
