import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPlayerAnalytics } from "@/lib/analytics/player-analytics";

const SUPPORTED_PERIODS = [30, 90, 180, 365] as const;

export type AnalyticsSnapshotRefreshResult = {
  playerId: number;
  periodDays: number;
  generatedAt: string;
  targetStatistics: number;
  trendPoints: number;
};

function normalizePeriod(periodDays: number) {
  return SUPPORTED_PERIODS.includes(periodDays as (typeof SUPPORTED_PERIODS)[number]) ? periodDays : 90;
}

export async function refreshPlayerAnalyticsSnapshot(
  playerId: number,
  periodDays = 90,
): Promise<AnalyticsSnapshotRefreshResult | null> {
  const period = normalizePeriod(periodDays);
  const analytics = await buildPlayerAnalytics(playerId, period);
  if (!analytics) return null;

  const generatedAt = new Date(analytics.generatedAt);
  const metricsJson = JSON.stringify({
    overview: analytics.overview,
    metrics: analytics.metrics,
    engineDistribution: analytics.engineDistribution,
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "PlayerPerformanceSnapshot" (
        "playerId", "periodDays", "generatedAt", "resultCount", "activeDays",
        "sessionCount", "average", "first9", "checkoutRate", "hitRate", "mpr",
        "highScore", "zeroVisits", "metricsJson", "updatedAt"
      ) VALUES (
        ${playerId}, ${period}, ${generatedAt}, ${analytics.overview.results},
        ${analytics.overview.activeDays}, ${analytics.overview.sessions},
        ${analytics.metrics.average}, ${analytics.metrics.first9},
        ${analytics.metrics.checkoutRate}, ${analytics.metrics.hitRate},
        ${analytics.metrics.mpr}, ${analytics.metrics.highScore},
        ${analytics.metrics.zeroVisits}, ${metricsJson}::jsonb, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("playerId", "periodDays") DO UPDATE SET
        "generatedAt" = EXCLUDED."generatedAt",
        "resultCount" = EXCLUDED."resultCount",
        "activeDays" = EXCLUDED."activeDays",
        "sessionCount" = EXCLUDED."sessionCount",
        "average" = EXCLUDED."average",
        "first9" = EXCLUDED."first9",
        "checkoutRate" = EXCLUDED."checkoutRate",
        "hitRate" = EXCLUDED."hitRate",
        "mpr" = EXCLUDED."mpr",
        "highScore" = EXCLUDED."highScore",
        "zeroVisits" = EXCLUDED."zeroVisits",
        "metricsJson" = EXCLUDED."metricsJson",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    await tx.$executeRaw`
      DELETE FROM "PlayerTargetStatistic"
      WHERE "playerId" = ${playerId} AND "periodDays" = ${period}
    `;

    for (const range of analytics.checkoutRanges) {
      await tx.$executeRaw`
        INSERT INTO "PlayerTargetStatistic" (
          "playerId", "periodDays", "category", "targetKey", "attempts",
          "successes", "rate", "generatedAt", "updatedAt"
        ) VALUES (
          ${playerId}, ${period}, 'CHECKOUT_RANGE', ${range.range},
          ${range.attempts}, ${range.successes}, ${range.rate},
          ${generatedAt}, CURRENT_TIMESTAMP
        )
      `;
    }

    await tx.$executeRaw`
      DELETE FROM "PlayerTrainingTrend"
      WHERE "playerId" = ${playerId} AND "periodDays" = ${period}
    `;

    for (const point of analytics.trend) {
      await tx.$executeRaw`
        INSERT INTO "PlayerTrainingTrend" (
          "playerId", "periodDays", "trainingDate", "average", "visits",
          "generatedAt", "updatedAt"
        ) VALUES (
          ${playerId}, ${period}, ${new Date(`${point.date}T00:00:00.000Z`)},
          ${point.average}, ${point.visits}, ${generatedAt}, CURRENT_TIMESTAMP
        )
      `;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  return {
    playerId,
    periodDays: period,
    generatedAt: generatedAt.toISOString(),
    targetStatistics: analytics.checkoutRanges.length,
    trendPoints: analytics.trend.length,
  };
}

export async function refreshAllPlayerAnalyticsSnapshots(periodDays = 90) {
  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const results: AnalyticsSnapshotRefreshResult[] = [];
  for (const player of players) {
    const refreshed = await refreshPlayerAnalyticsSnapshot(player.id, periodDays);
    if (refreshed) results.push(refreshed);
  }
  return results;
}

export async function getPlayerAnalyticsSnapshot(playerId: number, periodDays = 90) {
  const period = normalizePeriod(periodDays);
  const snapshots = await prisma.$queryRaw<Array<{
    generatedAt: Date;
    resultCount: number;
    activeDays: number;
    sessionCount: number;
    average: number;
    first9: number;
    checkoutRate: number;
    hitRate: number;
    mpr: number;
    highScore: number;
    zeroVisits: number;
    metricsJson: unknown;
  }>>`
    SELECT "generatedAt", "resultCount", "activeDays", "sessionCount", "average",
      "first9", "checkoutRate", "hitRate", "mpr", "highScore", "zeroVisits", "metricsJson"
    FROM "PlayerPerformanceSnapshot"
    WHERE "playerId" = ${playerId} AND "periodDays" = ${period}
    LIMIT 1
  `;

  if (!snapshots[0]) return null;

  const [targets, trend] = await Promise.all([
    prisma.$queryRaw<Array<{
      category: string;
      targetKey: string;
      attempts: number;
      successes: number;
      rate: number;
    }>>`
      SELECT "category", "targetKey", "attempts", "successes", "rate"
      FROM "PlayerTargetStatistic"
      WHERE "playerId" = ${playerId} AND "periodDays" = ${period}
      ORDER BY "category", "targetKey"
    `,
    prisma.$queryRaw<Array<{
      trainingDate: Date;
      average: number;
      visits: number;
    }>>`
      SELECT "trainingDate", "average", "visits"
      FROM "PlayerTrainingTrend"
      WHERE "playerId" = ${playerId} AND "periodDays" = ${period}
      ORDER BY "trainingDate" ASC
    `,
  ]);

  return {
    periodDays: period,
    ...snapshots[0],
    generatedAt: snapshots[0].generatedAt.toISOString(),
    targetStatistics: targets,
    trend: trend.map((item) => ({
      date: item.trainingDate.toISOString().slice(0, 10),
      average: item.average,
      visits: item.visits,
    })),
  };
}
