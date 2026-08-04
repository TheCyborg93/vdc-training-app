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

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function focusExercise(category: string, targetKey: string) {
  if (category === "DOUBLE") return [`Double Lock – ${targetKey}`, "Bob's 27 – Classic", "Around Doubles"];
  if (category === "TREBLE") return [`100 Darts at ${targetKey.replace("T", "")}`, "Switch – 20 & 19", "Treble Around"];
  if (category === "SINGLE") return [`Around the Clock – ${targetKey}`, "Segment Control", "Shanghai"];
  if (category === "BULL") return ["100 Darts at Bullseye", "Bullseye Challenge", "Finish 50"];
  return [`Catch 40 – Checkout ${targetKey}`, "121 – The Checkout Game", "Random Checkout"];
}

function buildComparison(
  current: NonNullable<Awaited<ReturnType<typeof buildPlayerAnalytics>>>,
  previous: NonNullable<Awaited<ReturnType<typeof buildPlayerAnalytics>>>,
) {
  const hasComparison = previous.overview.results > 0;
  const metrics = [
    { key: "average", label: "Average", current: current.metrics.average, previous: previous.metrics.average, unit: "" },
    { key: "first9", label: "First 9", current: current.metrics.first9, previous: previous.metrics.first9, unit: "" },
    { key: "checkoutRate", label: "Checkoutquote", current: current.metrics.checkoutRate, previous: previous.metrics.checkoutRate, unit: "%-Pkt." },
    { key: "hitRate", label: "Trefferquote", current: current.metrics.hitRate, previous: previous.metrics.hitRate, unit: "%-Pkt." },
    { key: "mpr", label: "Cricket MPR", current: current.metrics.mpr, previous: previous.metrics.mpr, unit: "" },
  ].map((item) => ({
    ...item,
    delta: hasComparison ? round(item.current - item.previous, item.key.includes("Rate") ? 1 : 2) : null,
  }));

  const comparable = metrics.filter((item) => item.delta !== null);
  const strongestImprovement = [...comparable].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0] ?? null;
  const biggestDecline = [...comparable].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))[0] ?? null;

  const previousTargets = new Map(
    previous.targetStatistics.map((item) => [`${item.category}:${item.targetKey}`, item]),
  );
  const targetChanges = current.targetStatistics
    .filter((item) => item.attempts >= 3)
    .map((item) => {
      const before = previousTargets.get(`${item.category}:${item.targetKey}`);
      return {
        ...item,
        previousRate: before?.rate ?? null,
        previousAttempts: before?.attempts ?? 0,
        delta: before && before.attempts >= 3 ? round(item.rate - before.rate, 1) : null,
      };
    });

  const focusTargets = [...targetChanges]
    .filter((item) => item.attempts >= 6)
    .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts)
    .slice(0, 3)
    .map((item) => ({
      category: item.category,
      targetKey: item.targetKey,
      rate: item.rate,
      attempts: item.attempts,
      reason: `${item.targetKey} liegt bei ${item.rate} % aus ${item.attempts} Versuchen.`,
      exerciseNames: focusExercise(item.category, item.targetKey),
    }));

  const improvingTargets = targetChanges
    .filter((item) => item.delta !== null && item.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 3);
  const decliningTargets = targetChanges
    .filter((item) => item.delta !== null && item.delta < 0)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 3);

  return {
    hasComparison,
    currentRange: current.range,
    previousRange: previous.range,
    previousResults: previous.overview.results,
    metrics,
    strongestImprovement,
    biggestDecline,
    improvingTargets,
    decliningTargets,
    focusTargets,
  };
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
    const current = await buildPlayerAnalytics(playerId, periodDays);
    if (!current) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });

    const previous = await buildPlayerAnalytics(playerId, periodDays, new Date(current.range.from));
    if (!previous) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });

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

    return NextResponse.json({
      ...current,
      comparison: buildComparison(current, previous),
      snapshot,
    }, {
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
