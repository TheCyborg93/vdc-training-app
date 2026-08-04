import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { buildPlayerAnalytics } from "@/lib/analytics/player-analytics";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await context.params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId) || playerId < 1) {
    return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });
  }

  const url = new URL(request.url);
  const rawPeriod = Number(url.searchParams.get("periodDays"));
  const periodDays = Number.isInteger(rawPeriod) ? Math.max(7, Math.min(365, rawPeriod)) : 90;

  try {
    const analytics = await buildPlayerAnalytics(playerId, periodDays);
    if (!analytics) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });
    return NextResponse.json(analytics, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    logger.error("Player analytics failed", error, { trainerId: trainer.id, playerId, periodDays });
    return NextResponse.json({ error: "Spieleranalyse konnte nicht erstellt werden." }, { status: 500 });
  }
}
