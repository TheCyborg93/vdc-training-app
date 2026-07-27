import "server-only";
import { prisma } from "@/lib/prisma";
import type { LiveTrainingSnapshot } from "./types";

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

export async function getLiveTrainingSnapshot(trainingId?: number): Promise<LiveTrainingSnapshot | null> {
  const hasRequestedTraining = Number.isInteger(trainingId) && Number(trainingId) > 0;

  const trainingDay = await prisma.trainingDay.findFirst({
    where: hasRequestedTraining
      ? { id: Number(trainingId) }
      : { status: { in: ["PUBLISHED", "RUNNING"] } },
    orderBy: hasRequestedTraining ? undefined : [{ trainingDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      trainingDate: true,
      status: true,
      trainingPlan: {
        select: {
          title: true,
          goal: true,
          durationMin: true,
          exercises: {
            orderBy: { position: "asc" },
            select: {
              exerciseId: true,
              exercise: { select: { id: true, name: true, description: true } },
            },
          },
        },
      },
      players: {
        orderBy: { player: { displayName: "asc" } },
        select: { playerId: true, player: { select: { id: true, displayName: true } } },
      },
      assignments: {
        orderBy: [{ boardId: "asc" }, { position: "asc" }],
        select: {
          boardId: true,
          playerId: true,
          player: { select: { id: true, displayName: true } },
        },
      },
      sessions: {
        orderBy: { boardId: "asc" },
        select: {
          id: true,
          boardId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          randomOrderJson: true,
          board: { select: { id: true, name: true, location: true, available: true } },
          _count: { select: { results: true } },
          results: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  if (!trainingDay) return null;

  const assignmentsByBoard = new Map<number, typeof trainingDay.assignments>();
  for (const assignment of trainingDay.assignments) {
    const entries = assignmentsByBoard.get(assignment.boardId) ?? [];
    entries.push(assignment);
    assignmentsByBoard.set(assignment.boardId, entries);
  }

  const boards = trainingDay.sessions.map((session) => {
    const progress = readProgress(session.randomOrderJson);
    const assignments = assignmentsByBoard.get(session.boardId) ?? [];
    const playersById = new Map(assignments.map((item) => [item.playerId, item.player]));
    const orderedPlayers = progress
      ? progress.order.map((id) => playersById.get(id)).filter((player): player is NonNullable<typeof player> => Boolean(player))
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
      lastResultAt: session.results[0]?.createdAt ?? null,
      players: orderedPlayers,
      currentPlayer,
      currentExercise: currentPlanExercise?.exercise ?? null,
      exerciseIndex: progress?.exerciseIndex ?? 0,
      totalExercises,
      progressPercent: session.status === "COMPLETED" ? 100 : progressPercent,
      resultCount: session._count.results,
    };
  });

  const assignedIds = new Set(trainingDay.assignments.map((assignment) => assignment.playerId));
  const roster = trainingDay.players.map((entry) => entry.player);

  return {
    id: trainingDay.id,
    trainingDate: trainingDay.trainingDate,
    status: trainingDay.status,
    trainingPlan: {
      title: trainingDay.trainingPlan.title,
      goal: trainingDay.trainingPlan.goal,
      durationMin: trainingDay.trainingPlan.durationMin,
    },
    roster,
    unassignedPlayers: roster.filter((player) => !assignedIds.has(player.id)),
    boards,
  };
}
