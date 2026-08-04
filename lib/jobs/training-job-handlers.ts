import { prisma } from "@/lib/prisma";
import type { StoredBackgroundJob } from "@/lib/jobs/types";
import { refreshPlayerAnalyticsSnapshot } from "@/lib/analytics/player-analytics-snapshot";

const ANALYTICS_PERIODS = [30, 90, 180, 365] as const;

function numericScore(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function loadTrainingReportData(trainingDayId: number) {
  const training = await prisma.trainingDay.findUnique({
    where: { id: trainingDayId },
    select: {
      id: true,
      trainingDate: true,
      status: true,
      publishedAt: true,
      trainingPlan: {
        select: {
          id: true,
          title: true,
          goal: true,
          durationMin: true,
          exercises: {
            orderBy: { position: "asc" },
            select: {
              position: true,
              durationMin: true,
              exercise: { select: { id: true, name: true, resultType: true } },
            },
          },
        },
      },
      players: {
        select: {
          player: { select: { id: true, displayName: true } },
        },
      },
      sessions: {
        select: {
          id: true,
          status: true,
          board: { select: { id: true, name: true } },
          startedAt: true,
          completedAt: true,
          results: {
            where: { deletedAt: null },
            select: {
              id: true,
              playerId: true,
              exerciseId: true,
              roundNumber: true,
              calculatedScore: true,
              createdAt: true,
              player: { select: { displayName: true } },
              exercise: { select: { name: true, resultType: true } },
            },
          },
        },
      },
    },
  });

  if (!training) throw new Error(`Trainingstag ${trainingDayId} wurde nicht gefunden.`);
  return training;
}

export async function buildTrainingAnalytics(trainingDayId: number) {
  const training = await loadTrainingReportData(trainingDayId);
  const results = training.sessions.flatMap((session) => session.results);
  const scores = results
    .map((result) => numericScore(result.calculatedScore))
    .filter((score): score is number => score !== null);

  const playerMap = new Map<number, { playerId: number; displayName: string; results: number; scoreTotal: number; scoredResults: number }>();
  for (const result of results) {
    const current = playerMap.get(result.playerId) ?? {
      playerId: result.playerId,
      displayName: result.player.displayName,
      results: 0,
      scoreTotal: 0,
      scoredResults: 0,
    };
    current.results += 1;
    const score = numericScore(result.calculatedScore);
    if (score !== null) {
      current.scoreTotal += score;
      current.scoredResults += 1;
    }
    playerMap.set(result.playerId, current);
  }

  const completedBoards = training.sessions.filter((session) => session.status === "COMPLETED").length;
  const averageScore = scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
    : null;

  return {
    trainingDayId: training.id,
    generatedAt: new Date().toISOString(),
    trainingStatus: training.status,
    boardCount: training.sessions.length,
    completedBoards,
    completionRate: training.sessions.length
      ? Math.round((completedBoards / training.sessions.length) * 100)
      : 0,
    playerCount: training.players.length,
    resultCount: results.length,
    averageScore,
    players: [...playerMap.values()]
      .map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        resultCount: player.results,
        averageScore: player.scoredResults
          ? Math.round((player.scoreTotal / player.scoredResults) * 100) / 100
          : null,
      }))
      .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)),
  };
}

async function resolveAnalyticsPlayerIds(payload: StoredBackgroundJob<"ANALYTICS_REFRESH">["payload"]) {
  if (payload.playerId) return [payload.playerId];

  if (payload.trainingDayId) {
    const rows = await prisma.trainingDayPlayer.findMany({
      where: { trainingDayId: payload.trainingDayId },
      select: { playerId: true },
      orderBy: { playerId: "asc" },
    });
    return rows.map((row) => row.playerId);
  }

  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return players.map((player) => player.id);
}

async function refreshPlayerSnapshots(playerIds: number[]) {
  const refreshed: Array<{ playerId: number; periods: number[] }> = [];
  const failures: Array<{ playerId: number; periodDays: number; error: string }> = [];

  for (const playerId of [...new Set(playerIds)]) {
    const periods: number[] = [];
    for (const periodDays of ANALYTICS_PERIODS) {
      try {
        const result = await refreshPlayerAnalyticsSnapshot(playerId, periodDays);
        if (result) periods.push(periodDays);
      } catch (error) {
        failures.push({
          playerId,
          periodDays,
          error: error instanceof Error ? error.message : "Unbekannter Analysefehler",
        });
      }
    }
    if (periods.length) refreshed.push({ playerId, periods });
  }

  return { refreshed, failures };
}

export async function handleAnalyticsRefreshJob(
  job: StoredBackgroundJob<"ANALYTICS_REFRESH">,
) {
  const playerIds = await resolveAnalyticsPlayerIds(job.payload);
  const snapshots = await refreshPlayerSnapshots(playerIds);
  const trainingAnalytics = job.payload.trainingDayId
    ? await buildTrainingAnalytics(job.payload.trainingDayId)
    : null;

  if (!snapshots.refreshed.length && snapshots.failures.length) {
    throw new Error(`Keine Spieleranalyse konnte aktualisiert werden: ${snapshots.failures[0]?.error}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    scope: job.payload.playerId
      ? "PLAYER"
      : job.payload.trainingDayId
        ? "TRAINING_DAY"
        : "CLUB",
    playerCount: playerIds.length,
    snapshots,
    trainingAnalytics,
  };
}

export async function handleTrainingReportJob(
  job: StoredBackgroundJob<"TRAINING_REPORT">,
) {
  const training = await loadTrainingReportData(job.payload.trainingDayId);
  const analytics = await buildTrainingAnalytics(job.payload.trainingDayId);

  return {
    format: job.payload.format ?? "JSON",
    generatedAt: new Date().toISOString(),
    training: {
      id: training.id,
      date: training.trainingDate.toISOString(),
      status: training.status,
      publishedAt: training.publishedAt?.toISOString() ?? null,
      plan: training.trainingPlan,
      players: training.players.map((entry) => entry.player),
      boards: training.sessions.map((session) => ({
        id: session.id,
        board: session.board,
        status: session.status,
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        resultCount: session.results.length,
      })),
    },
    analytics,
  };
}
