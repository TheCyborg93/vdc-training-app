import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { buildPlayerAnalytics } from "@/lib/analytics/player-analytics";
import {
  getPlayerAnalyticsSnapshot,
  refreshPlayerAnalyticsSnapshot,
} from "@/lib/analytics/player-analytics-snapshot";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

function parseRequest(request: Request, id: string) {
  const playerId = Number(id);
  const url = new URL(request.url);
  const rawPeriod = Number(url.searchParams.get("periodDays"));
  const periodDays = Number.isInteger(rawPeriod) ? Math.max(7, Math.min(365, rawPeriod)) : 90;
  return { playerId, periodDays };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await context.params;
  const { playerId, periodDays } = parseRequest(request, id);
  if (!Number.isInteger(playerId) || playerId < 1) {
    return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });
  }

  try {
    const analytics = await buildPlayerAnalytics(playerId, periodDays);
    if (!analytics) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });

    let snapshot = null;
    try {
      snapshot = await getPlayerAnalyticsSnapshot(playerId, periodDays);
    } catch (snapshotError) {
      logger.warn("Player analytics snapshot unavailable", {
        trainerId: trainer.id,
        playerId,
        periodDays,
        error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
      });
    }

    return NextResponse.json({ ...analytics, snapshot }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    logger.error("Player analytics failed", error, { trainerId: trainer.id, playerId, periodDays });
    return NextResponse.json({ error: "Spieleranalyse konnte nicht erstellt werden." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (trainer.role !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren dürfen Analyse-Snapshots aktualisieren." }, { status: 403 });
  }

  const { id } = await context.params;
  const { playerId, periodDays } = parseRequest(request, id);
  if (!Number.isInteger(playerId) || playerId < 1) {
    return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });
  }

  try {
    const result = await refreshPlayerAnalyticsSnapshot(playerId, periodDays);
    if (!result) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });
    return NextResponse.json({ refreshed: true, result });
  } catch (error) {
    logger.error("Player analytics snapshot refresh failed", error, {
      trainerId: trainer.id,
      playerId,
      periodDays,
    });
    return NextResponse.json(
      { error: "Analyse-Snapshot konnte nicht aktualisiert werden. Wurde die Migration ausgeführt?" },
      { status: 500 },
    );
  }
}
