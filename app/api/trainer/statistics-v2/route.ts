import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCoachProfile, type CoachResultInput } from "@/lib/ai-coach";

export const preferredRegion = "lhr1";
export const runtime = "nodejs";

type PeriodKey = "7" | "30" | "90" | "365" | "all";
type SourceKey = "ALL" | "CLUB" | "HOME";
type ResultRow = CoachResultInput & {
  playerId: number;
  source: "CLUB" | "HOME";
};

const periodDays: Record<Exclude<PeriodKey, "all">, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "365": 365,
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resultScore(result: ResultRow): number {
  const value = objectValue(result.valueJson);
  const checkout = value.checkout === true;
  const hits = finite(value.hits);
  const marks = finite(value.marksAdded ?? value.marks);
  const score = result.calculatedScore ?? finite(value.points) ?? finite(value.score) ?? finite(value.visitScore) ?? 0;
  if (checkout) return 100;
  if (hits !== null) return Math.max(0, Math.min(100, hits / 3 * 100));
  if (marks !== null) return Math.max(0, Math.min(100, marks / 3 * 100));
  if (result.exercise.resultType === "CHECKOUT") return 0;
  if (/X01|SCORING/.test(result.exercise.engine)) return Math.max(0, Math.min(100, score / 100 * 100));
  return Math.max(0, Math.min(100, score <= 3 ? score / 3 * 100 : score <= 100 ? score : score / 1.8));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function weekKey(value: Date | string): string {
  const date = new Date(value);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

function resultLabel(result: ResultRow): string {
  const categories = result.exercise.categories.map((entry) => entry.category.name);
  const tags = Array.isArray(result.exercise.tagsJson) ? result.exercise.tagsJson.map(String) : [];
  return [result.exercise.name, result.exercise.engine, ...categories, ...tags].join(" ").toLowerCase();
}

function checkoutSuccess(result: ResultRow): boolean {
  return objectValue(result.valueJson).checkout === true;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get("period") ?? "90") as PeriodKey;
    const source = (url.searchParams.get("source") ?? "ALL") as SourceKey;
    const playerIdParam = Number(url.searchParams.get("playerId"));
    const playerId = Number.isInteger(playerIdParam) && playerIdParam > 0 ? playerIdParam : null;
    const since = period === "all" ? undefined : new Date(Date.now() - (periodDays[period] ?? 90) * 86_400_000);

    const resultWhere = { deletedAt: null, ...(since ? { createdAt: { gte: since } } : {}), ...(playerId ? { playerId } : {}) };
    const select = {
      playerId: true,
      calculatedScore: true,
      valueJson: true,
      createdAt: true,
      exercise: {
        select: {
          id: true,
          name: true,
          resultType: true,
          engine: true,
          tagsJson: true,
          categories: { select: { category: { select: { name: true } } } },
        },
      },
    } as const;

    const [players, clubResults, homeResults] = await Promise.all([
      prisma.player.findMany({
        where: { active: true, ...(playerId ? { id: playerId } : {}) },
        orderBy: { displayName: "asc" },
        select: { id: true, firstName: true, displayName: true },
      }),
      source === "HOME" ? Promise.resolve([]) : prisma.exerciseResult.findMany({ where: resultWhere, select, orderBy: { createdAt: "asc" } }),
      source === "CLUB" ? Promise.resolve([]) : prisma.homeExerciseResult.findMany({ where: resultWhere, select, orderBy: { createdAt: "asc" } }),
    ]);

    const results: ResultRow[] = [
      ...clubResults.map((result) => ({ ...result, source: "CLUB" as const })),
      ...homeResults.map((result) => ({ ...result, source: "HOME" as const })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const activeDays = new Set(results.map((result) => dateKey(result.createdAt))).size;
    const checkoutResults = results.filter((result) => result.exercise.resultType === "CHECKOUT" || /checkout|finish|catch 40|121|170/.test(resultLabel(result)));
    const checkoutRate = checkoutResults.length ? checkoutResults.filter(checkoutSuccess).length / checkoutResults.length * 100 : 0;
    const scores = results.map(resultScore);

    const playerStats = players.map((player) => {
      const playerResults = results.filter((result) => result.playerId === player.id);
      const days = new Set(playerResults.map((result) => dateKey(result.createdAt))).size;
      const profile = buildCoachProfile(playerResults, days);
      const playerCheckout = playerResults.filter((result) => result.exercise.resultType === "CHECKOUT" || /checkout|finish|catch 40|121|170/.test(resultLabel(result)));
      const sourceCounts = {
        club: playerResults.filter((result) => result.source === "CLUB").length,
        home: playerResults.filter((result) => result.source === "HOME").length,
      };
      return {
        playerId: player.id,
        firstName: player.firstName,
        dartName: player.displayName,
        performanceIndex: profile.performanceIndex,
        trend: Math.round(average(profile.areas.map((area) => area.trend))),
        activeDays: days,
        resultCount: playerResults.length,
        averagePerformance: Math.round(average(playerResults.map(resultScore))),
        checkoutRate: playerCheckout.length ? Math.round(playerCheckout.filter(checkoutSuccess).length / playerCheckout.length * 100) : 0,
        strongest: profile.strongest[0]?.label ?? "–",
        weakest: profile.weakest[0]?.label ?? "–",
        sourceCounts,
      };
    }).sort((a, b) => b.performanceIndex - a.performanceIndex);

    const exerciseMap = new Map<number, { exerciseId: number; name: string; results: number[]; players: Set<number>; count: number; checkoutAttempts: number; checkoutSuccesses: number }>();
    for (const result of results) {
      const current = exerciseMap.get(result.exercise.id) ?? { exerciseId: result.exercise.id, name: result.exercise.name, results: [], players: new Set<number>(), count: 0, checkoutAttempts: 0, checkoutSuccesses: 0 };
      current.results.push(resultScore(result));
      current.players.add(result.playerId);
      current.count += 1;
      if (result.exercise.resultType === "CHECKOUT") {
        current.checkoutAttempts += 1;
        if (checkoutSuccess(result)) current.checkoutSuccesses += 1;
      }
      exerciseMap.set(result.exercise.id, current);
    }
    const exercises = [...exerciseMap.values()].map((item) => ({
      exerciseId: item.exerciseId,
      name: item.name,
      resultCount: item.count,
      playerCount: item.players.size,
      averagePerformance: Math.round(average(item.results)),
      checkoutRate: item.checkoutAttempts ? Math.round(item.checkoutSuccesses / item.checkoutAttempts * 100) : null,
    })).sort((a, b) => b.resultCount - a.resultCount);

    const trendMap = new Map<string, number[]>();
    for (const result of results) {
      const key = weekKey(result.createdAt);
      const bucket = trendMap.get(key) ?? [];
      bucket.push(resultScore(result));
      trendMap.set(key, bucket);
    }
    const trend = [...trendMap.entries()].map(([week, values]) => ({ week, value: Math.round(average(values)), results: values.length })).slice(-16);

    const activityMap = new Map<string, { club: number; home: number }>();
    for (const result of results) {
      const key = dateKey(result.createdAt);
      const bucket = activityMap.get(key) ?? { club: 0, home: 0 };
      if (result.source === "CLUB") bucket.club += 1;
      else bucket.home += 1;
      activityMap.set(key, bucket);
    }
    const activity = [...activityMap.entries()].map(([date, counts]) => ({ date, ...counts, total: counts.club + counts.home })).slice(-30);

    const bestExercise = exercises.filter((item) => item.resultCount >= 3).sort((a, b) => b.averagePerformance - a.averagePerformance)[0] ?? null;
    const mostActivePlayer = [...playerStats].sort((a, b) => b.activeDays - a.activeDays || b.resultCount - a.resultCount)[0] ?? null;
    const biggestImprovement = [...playerStats].sort((a, b) => b.trend - a.trend)[0] ?? null;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      filters: { period, source, playerId },
      overview: {
        players: players.length,
        results: results.length,
        activeDays,
        averagePerformance: Math.round(average(scores)),
        checkoutRate: Math.round(checkoutRate),
        clubResults: results.filter((result) => result.source === "CLUB").length,
        homeResults: results.filter((result) => result.source === "HOME").length,
      },
      highlights: { bestExercise, mostActivePlayer, biggestImprovement },
      players: playerStats,
      exercises: exercises.slice(0, 30),
      trend,
      activity,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Statistics V2 GET failed", error);
    return NextResponse.json({ error: "Die Statistiken konnten nicht geladen werden." }, { status: 500 });
  }
}
