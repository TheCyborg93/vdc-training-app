import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { buildPlayerAnalytics } from "@/lib/analytics/player-analytics";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : 0;
}

function delta(current: number, previous: number, hasPrevious: boolean) {
  return hasPrevious ? Math.round((current - previous) * 100) / 100 : null;
}

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(request.url);
  const rawPeriod = Number(url.searchParams.get("periodDays"));
  const periodDays = Number.isInteger(rawPeriod) ? Math.max(7, Math.min(365, rawPeriod)) : 90;
  const currentEnd = new Date();
  const previousEnd = new Date(currentEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  try {
    const players = await prisma.player.findMany({
      where: { active: true },
      select: { id: true, displayName: true, firstName: true },
      orderBy: { displayName: "asc" },
    });

    const analyticsPairs = await Promise.all(players.map(async (player) => {
      const [current, previous] = await Promise.all([
        buildPlayerAnalytics(player.id, periodDays, currentEnd),
        buildPlayerAnalytics(player.id, periodDays, previousEnd),
      ]);
      return { player, current, previous };
    }));

    const rows = analyticsPairs
      .filter((item): item is typeof item & { current: NonNullable<typeof item.current> } => item.current !== null)
      .map(({ player, current, previous }) => {
        const hasPrevious = Boolean(previous && previous.overview.results > 0);
        return {
          playerId: player.id,
          playerName: player.displayName,
          firstName: player.firstName,
          results: current.overview.results,
          activeDays: current.overview.activeDays,
          sessions: current.overview.sessions,
          average: current.metrics.average,
          first9: current.metrics.first9,
          checkoutRate: current.metrics.checkoutRate,
          hitRate: current.metrics.hitRate,
          mpr: current.metrics.mpr,
          highScore: current.metrics.highScore,
          zeroVisits: current.metrics.zeroVisits,
          dataQuality: current.overview.results >= 30 ? "STRONG" : current.overview.results >= 10 ? "MEDIUM" : "LOW",
          comparison: {
            hasPrevious,
            previousResults: previous?.overview.results ?? 0,
            average: delta(current.metrics.average, previous?.metrics.average ?? 0, hasPrevious),
            first9: delta(current.metrics.first9, previous?.metrics.first9 ?? 0, hasPrevious),
            checkoutRate: delta(current.metrics.checkoutRate, previous?.metrics.checkoutRate ?? 0, hasPrevious),
            hitRate: delta(current.metrics.hitRate, previous?.metrics.hitRate ?? 0, hasPrevious),
            mpr: delta(current.metrics.mpr, previous?.metrics.mpr ?? 0, hasPrevious),
          },
        };
      });

    const scored = rows.filter((row) => row.results > 0);
    const previousRows = rows.filter((row) => row.comparison.hasPrevious);
    const ranked = [...rows]
      .sort((a, b) => b.average - a.average || b.checkoutRate - a.checkoutRate)
      .map((row, index) => ({ ...row, rank: row.results > 0 ? index + 1 : null }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      periodDays,
      windows: {
        current: { start: new Date(currentEnd.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString(), end: currentEnd.toISOString() },
        previous: { start: new Date(previousEnd.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString(), end: previousEnd.toISOString() },
      },
      overview: {
        players: rows.length,
        analyzedPlayers: scored.length,
        playersWithComparison: previousRows.length,
        results: rows.reduce((sum, row) => sum + row.results, 0),
        average: average(scored.map((row) => row.average)),
        first9: average(scored.map((row) => row.first9)),
        checkoutRate: average(scored.map((row) => row.checkoutRate)),
        hitRate: average(scored.map((row) => row.hitRate)),
        trend: {
          average: average(previousRows.map((row) => row.comparison.average ?? 0)),
          first9: average(previousRows.map((row) => row.comparison.first9 ?? 0)),
          checkoutRate: average(previousRows.map((row) => row.comparison.checkoutRate ?? 0)),
          hitRate: average(previousRows.map((row) => row.comparison.hitRate ?? 0)),
        },
      },
      players: ranked,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    logger.error("Club analytics comparison failed", error, { trainerId: trainer.id, periodDays });
    return NextResponse.json({ error: "Vereinsvergleich konnte nicht erstellt werden." }, { status: 500 });
  }
}
