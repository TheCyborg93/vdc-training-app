import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;

type AnalyticsResult = {
  source: "CLUB" | "HOME";
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  engine: string;
  roundNumber: number;
  value: JsonRecord;
  calculatedScore: number | null;
  createdAt: Date;
};

export type PlayerTargetAnalytics = {
  category: "CHECKOUT" | "DOUBLE" | "TREBLE" | "SINGLE" | "BULL";
  targetKey: string;
  attempts: number;
  successes: number;
  rate: number;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function scoreOf(result: AnalyticsResult): number | null {
  return numberValue(result.value.score ?? result.value.total ?? result.calculatedScore);
}

function checkoutOf(result: AnalyticsResult): boolean | null {
  return booleanValue(result.value.checkout ?? result.value.success ?? result.value.reachedTarget);
}

function hitsOf(result: AnalyticsResult): { hits: number; darts: number } | null {
  const hits = numberValue(result.value.hits ?? result.value.marks);
  if (hits == null) return null;
  const darts = numberValue(result.value.dartsAllowed ?? result.value.dartsUsed ?? result.value.darts) ?? 3;
  return { hits: Math.max(0, hits), darts: Math.max(1, darts) };
}

function targetOf(result: AnalyticsResult): number | null {
  return numberValue(result.value.target);
}

function checkoutRange(target: number) {
  if (target <= 60) return "40–60";
  if (target <= 80) return "61–80";
  if (target <= 100) return "81–100";
  if (target <= 130) return "101–130";
  return "131–170";
}

function normalizedTargetText(result: AnalyticsResult) {
  return `${String(result.value.target ?? "")} ${result.exerciseName}`.toUpperCase()
    .replace(/DOUBLE/g, "D")
    .replace(/DOPPEL/g, "D")
    .replace(/TRIPLE/g, "T")
    .replace(/TREBLE/g, "T")
    .replace(/SINGLE/g, "S")
    .replace(/BULLSEYE|BULL'S EYE/g, "BULL")
    .replace(/\s+/g, " ")
    .trim();
}

function exactBoardTarget(result: AnalyticsResult): { category: PlayerTargetAnalytics["category"]; targetKey: string } | null {
  const text = normalizedTargetText(result);
  if (/\b(DBULL|D25|BULL)\b/.test(text)) return { category: "BULL", targetKey: "BULL" };
  if (/\b(SBULL|S25)\b/.test(text)) return { category: "BULL", targetKey: "SBULL" };

  const prefixed = text.match(/(?:^|\W)([DST])\s*(20|1[0-9]|[1-9])(?:\W|$)/);
  if (prefixed) {
    const prefix = prefixed[1];
    const value = Number(prefixed[2]);
    if (prefix === "D") return { category: "DOUBLE", targetKey: `D${value}` };
    if (prefix === "T") return { category: "TREBLE", targetKey: `T${value}` };
    return { category: "SINGLE", targetKey: `S${value}` };
  }

  if (["AROUND_DOUBLES", "DOUBLES_ROUNDS", "BOB27"].includes(result.engine)) {
    const target = numberValue(result.value.target);
    if (target != null && target >= 1 && target <= 20) return { category: "DOUBLE", targetKey: `D${target}` };
  }
  if (result.engine === "AROUND_TREBLES") {
    const target = numberValue(result.value.target);
    if (target != null && target >= 1 && target <= 20) return { category: "TREBLE", targetKey: `T${target}` };
  }
  if (result.engine === "AROUND_CLOCK") {
    const target = numberValue(result.value.target);
    if (target != null && target >= 1 && target <= 20) return { category: "SINGLE", targetKey: `S${target}` };
  }
  if (result.engine === "BULL_ROUNDS") return { category: "BULL", targetKey: "BULL" };
  return null;
}

function addTargetStat(
  map: Map<string, PlayerTargetAnalytics>,
  category: PlayerTargetAnalytics["category"],
  targetKey: string,
  attempts: number,
  successes: number,
) {
  if (attempts <= 0) return;
  const key = `${category}:${targetKey}`;
  const current = map.get(key) ?? { category, targetKey, attempts: 0, successes: 0, rate: 0 };
  current.attempts += attempts;
  current.successes += Math.max(0, Math.min(attempts, successes));
  current.rate = current.attempts ? round(current.successes / current.attempts * 100, 1) : 0;
  map.set(key, current);
}

export async function buildPlayerAnalytics(playerId: number, periodDays = 90) {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, displayName: true, firstName: true, lastName: true, active: true },
  });
  if (!player) return null;

  const [club, home] = await Promise.all([
    prisma.exerciseResult.findMany({
      where: { playerId, deletedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: {
        boardSessionId: true,
        exerciseId: true,
        roundNumber: true,
        valueJson: true,
        calculatedScore: true,
        createdAt: true,
        exercise: { select: { name: true, engine: true } },
      },
    }),
    prisma.homeExerciseResult.findMany({
      where: { playerId, deletedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: {
        homeTrainingSessionId: true,
        exerciseId: true,
        roundNumber: true,
        valueJson: true,
        calculatedScore: true,
        createdAt: true,
        exercise: { select: { name: true, engine: true } },
      },
    }),
  ]);

  const results: AnalyticsResult[] = [
    ...club.map((item) => ({ source: "CLUB" as const, sessionId: item.boardSessionId, exerciseId: item.exerciseId, exerciseName: item.exercise.name, engine: String(item.exercise.engine), roundNumber: item.roundNumber, value: record(item.valueJson), calculatedScore: item.calculatedScore, createdAt: item.createdAt })),
    ...home.map((item) => ({ source: "HOME" as const, sessionId: item.homeTrainingSessionId, exerciseId: item.exerciseId, exerciseName: item.exercise.name, engine: String(item.exercise.engine), roundNumber: item.roundNumber, value: record(item.valueJson), calculatedScore: item.calculatedScore, createdAt: item.createdAt })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const scores = results.map(scoreOf).filter((value): value is number => value != null);
  const checkoutResults = results.map((result) => ({ result, success: checkoutOf(result) })).filter((item): item is { result: AnalyticsResult; success: boolean } => item.success != null);
  const hitResults = results.map(hitsOf).filter((value): value is { hits: number; darts: number } => value != null);
  const cricketMarks = results.filter((result) => result.engine === "CRICKET").map((result) => numberValue(result.value.marks ?? result.value.hits)).filter((value): value is number => value != null);

  const first9Groups = new Map<string, AnalyticsResult[]>();
  for (const result of results.filter((item) => item.engine === "X01")) {
    const key = `${result.source}:${result.sessionId}:${result.exerciseId}`;
    const group = first9Groups.get(key) ?? [];
    group.push(result);
    first9Groups.set(key, group);
  }
  const first9Values = [...first9Groups.values()].map((group) => group.sort((a, b) => a.roundNumber - b.roundNumber).slice(0, 3).map(scoreOf).filter((value): value is number => value != null)).filter((group) => group.length === 3).map((group) => average(group));

  const checkoutRanges = new Map<string, { attempts: number; successes: number }>();
  const targetStatistics = new Map<string, PlayerTargetAnalytics>();

  for (const item of checkoutResults) {
    const target = targetOf(item.result);
    if (target == null || target < 2 || target > 170) continue;
    addTargetStat(targetStatistics, "CHECKOUT", String(Math.trunc(target)), 1, item.success ? 1 : 0);
    if (target >= 40) {
      const key = checkoutRange(target);
      const current = checkoutRanges.get(key) ?? { attempts: 0, successes: 0 };
      current.attempts += 1;
      if (item.success) current.successes += 1;
      checkoutRanges.set(key, current);
    }
  }

  for (const result of results) {
    const boardTarget = exactBoardTarget(result);
    if (!boardTarget) continue;
    const hits = hitsOf(result);
    if (hits) {
      addTargetStat(targetStatistics, boardTarget.category, boardTarget.targetKey, hits.darts, hits.hits);
      continue;
    }
    const success = checkoutOf(result);
    if (success != null) addTargetStat(targetStatistics, boardTarget.category, boardTarget.targetKey, 1, success ? 1 : 0);
  }

  const engines = new Map<string, number>();
  for (const result of results) engines.set(result.engine, (engines.get(result.engine) ?? 0) + 1);

  const daily = new Map<string, number[]>();
  for (const result of results) {
    const score = scoreOf(result);
    if (score == null) continue;
    const day = result.createdAt.toISOString().slice(0, 10);
    const values = daily.get(day) ?? [];
    values.push(score);
    daily.set(day, values);
  }

  const activeDays = new Set(results.map((result) => result.createdAt.toISOString().slice(0, 10)));
  const sessions = new Set(results.map((result) => `${result.source}:${result.sessionId}`));
  const totalHits = hitResults.reduce((sum, item) => sum + item.hits, 0);
  const totalDarts = hitResults.reduce((sum, item) => sum + item.darts, 0);
  const checkoutSuccesses = checkoutResults.filter((item) => item.success).length;

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    player,
    overview: {
      results: results.length,
      activeDays: activeDays.size,
      sessions: sessions.size,
      clubResults: club.length,
      homeResults: home.length,
    },
    metrics: {
      average: round(average(scores)),
      first9: round(average(first9Values)),
      checkoutRate: checkoutResults.length ? round(checkoutSuccesses / checkoutResults.length * 100, 1) : 0,
      checkoutAttempts: checkoutResults.length,
      checkoutSuccesses,
      hitRate: totalDarts ? round(totalHits / totalDarts * 100, 1) : 0,
      hits: totalHits,
      trackedDarts: totalDarts,
      mpr: round(average(cricketMarks)),
      highScore: scores.length ? Math.max(...scores) : 0,
      zeroVisits: scores.filter((score) => score === 0).length,
    },
    checkoutRanges: [...checkoutRanges.entries()].map(([range, item]) => ({ range, ...item, rate: item.attempts ? round(item.successes / item.attempts * 100, 1) : 0 })),
    targetStatistics: [...targetStatistics.values()].sort((a, b) => a.category.localeCompare(b.category) || a.targetKey.localeCompare(b.targetKey, undefined, { numeric: true })),
    engineDistribution: [...engines.entries()].map(([engine, count]) => ({ engine, count })).sort((a, b) => b.count - a.count),
    trend: [...daily.entries()].map(([date, values]) => ({ date, average: round(average(values)), visits: values.length })).slice(-30),
  };
}
