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

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(request.url);
  const rawPeriod = Number(url.searchParams.get("periodDays"));
  const periodDays = Number.isInteger(rawPeriod) ? Math.max(7, Math.min(365, rawPeriod)) : 90;

  try {
    const players = await prisma.player.findMany({
      where: { active: true },
      select: { id: true, displayName: true, firstName: true },
      orderBy: { displayName: "asc" },
    });

    const analytics = await Promise.all(players.map((player) => buildPlayerAnalytics(player.id, periodDays)));
    const rows = analytics
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => ({
        playerId: item.player.id,
        playerName: item.player.displayName,
        firstName: item.player.firstName,
        results: item.overview.results,
        activeDays: item.overview.activeDays,
        sessions: item.overview.sessions,
        average: item.metrics.average,
        first9: item.metrics.first9,
        checkoutRate: item.metrics.checkoutRate,
        hitRate: item.metrics.hitRate,
        mpr: item.metrics.mpr,
        highScore: item.metrics.highScore,
        zeroVisits: item.metrics.zeroVisits,
        dataQuality: item.overview.results >= 30 ? "STRONG" : item.overview.results >= 10 ? "MEDIUM" : "LOW",
      }));

    const scored = rows.filter((row) => row.results > 0);
    const ranked = [...rows]
      .sort((a, b) => b.average - a.average || b.checkoutRate - a.checkoutRate)
      .map((row, index) => ({ ...row, rank: row.results > 0 ? index + 1 : null }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      periodDays,
      overview: {
        players: rows.length,
        analyzedPlayers: scored.length,
        results: rows.reduce((sum, row) => sum + row.results, 0),
        average: average(scored.map((row) => row.average)),
        first9: average(scored.map((row) => row.first9)),
        checkoutRate: average(scored.map((row) => row.checkoutRate)),
        hitRate: average(scored.map((row) => row.hitRate)),
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
