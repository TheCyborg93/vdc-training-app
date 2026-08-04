import { prisma } from "@/lib/prisma";
import type { TrainingHistoryType } from "@/lib/history/training-history";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null;
}

function metrics(results: Array<{ calculatedScore: number | null }>) {
  const scores = results.map((item) => numberOrNull(item.calculatedScore)).filter((value): value is number => value !== null);
  return {
    resultCount: results.length,
    scoredResults: scores.length,
    average: average(scores),
    highScore: scores.length ? Math.max(...scores) : null,
    zeroVisits: scores.filter((score) => score === 0).length,
  };
}

export async function getTrainingHistoryDetail(type: TrainingHistoryType, id: number) {
  if (type === "CLUB") {
    const day = await prisma.trainingDay.findUnique({
      where: { id },
      include: {
        trainingPlan: {
          include: {
            exercises: {
              orderBy: { position: "asc" },
              include: { exercise: true },
            },
          },
        },
        assignments: { include: { player: true, board: true } },
        sessions: {
          orderBy: { id: "asc" },
          include: {
            board: true,
            results: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: { player: true, exercise: true },
            },
          },
        },
      },
    });
    if (!day) return null;

    const allResults = day.sessions.flatMap((session) => session.results);
    const players = [...new Map(day.assignments.map((entry) => [entry.player.id, entry.player] as const)).values()];
    const exerciseRows = day.trainingPlan.exercises.map((entry) => {
      const results = allResults.filter((result) => result.exerciseId === entry.exerciseId);
      return {
        id: entry.exercise.id,
        name: entry.exercise.name,
        engine: String(entry.exercise.engine),
        position: entry.position,
        durationMin: entry.durationMin,
        ...metrics(results),
      };
    });

    return {
      type: "CLUB" as const,
      id: day.id,
      title: day.trainingPlan.title,
      goal: day.trainingPlan.goal,
      status: day.status,
      startedAt: day.trainingDate.toISOString(),
      completedAt: day.sessions.map((session) => session.completedAt).filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null,
      durationMin: day.trainingPlan.durationMin,
      players: players.map((player) => ({ id: player.id, name: player.displayName })),
      boards: day.sessions.map((session) => ({ id: session.board.id, name: session.board.name, status: session.status })),
      metrics: metrics(allResults),
      exercises: exerciseRows,
      sessions: day.sessions.map((session) => ({
        id: session.id,
        board: session.board.name,
        status: session.status,
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        metrics: metrics(session.results),
      })),
      results: allResults.map((result) => ({
        id: result.id,
        playerId: result.playerId,
        playerName: result.player.displayName,
        exerciseId: result.exerciseId,
        exerciseName: result.exercise.name,
        engine: String(result.exercise.engine),
        boardSessionId: result.boardSessionId,
        board: day.sessions.find((session) => session.id === result.boardSessionId)?.board.name ?? "–",
        roundNumber: result.roundNumber,
        score: numberOrNull(result.calculatedScore),
        value: record(result.valueJson),
        createdAt: result.createdAt.toISOString(),
      })),
    };
  }

  const session = await prisma.homeTrainingSession.findUnique({
    where: { id },
    include: {
      player: true,
      plan: true,
      results: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { exercise: true },
      },
    },
  });
  if (!session) return null;

  const grouped = new Map<number, typeof session.results>();
  for (const result of session.results) {
    const list = grouped.get(result.exerciseId) ?? [];
    list.push(result);
    grouped.set(result.exerciseId, list);
  }

  const completedAt = session.completedAt;
  const durationMin = completedAt
    ? Math.max(1, Math.round((completedAt.getTime() - session.startedAt.getTime()) / 60000))
    : session.plan.durationMin;

  return {
    type: "HOME" as const,
    id: session.id,
    title: session.plan.title,
    goal: session.plan.goal,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null,
    durationMin,
    players: [{ id: session.player.id, name: session.player.displayName }],
    boards: [] as Array<{ id: number; name: string; status: string }>,
    metrics: metrics(session.results),
    exercises: [...grouped.values()].map((results, index) => ({
      id: results[0].exercise.id,
      name: results[0].exercise.name,
      engine: String(results[0].exercise.engine),
      position: index + 1,
      durationMin: null,
      ...metrics(results),
    })),
    sessions: [{
      id: session.id,
      board: "Heimboard",
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: completedAt?.toISOString() ?? null,
      metrics: metrics(session.results),
    }],
    results: session.results.map((result) => ({
      id: result.id,
      playerId: session.player.id,
      playerName: session.player.displayName,
      exerciseId: result.exerciseId,
      exerciseName: result.exercise.name,
      engine: String(result.exercise.engine),
      boardSessionId: session.id,
      board: "Heimboard",
      roundNumber: result.roundNumber,
      score: numberOrNull(result.calculatedScore),
      value: record(result.valueJson),
      createdAt: result.createdAt.toISOString(),
    })),
  };
}
