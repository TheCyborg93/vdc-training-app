import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TrendResult = {
  createdAt: Date;
  calculatedScore: number | null;
  exercise: { name: string; resultType: string };
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function dayKey(value: Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function summarize(results: TrendResult[]) {
  const scored = results.map((item) => item.calculatedScore).filter((value): value is number => value !== null);
  const checkout = results.filter((item) => item.exercise.resultType === "CHECKOUT");
  const checkoutSuccess = checkout.filter((item) => item.calculatedScore === 1).length;
  return {
    results: results.length,
    activeDays: new Set(results.map((item) => dayKey(item.createdAt))).size,
    average: scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null,
    best: scored.length ? Math.max(...scored) : null,
    checkoutRate: checkout.length ? (checkoutSuccess / checkout.length) * 100 : null,
  };
}

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return current - previous;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    }

    const now = new Date();
    const currentStart = addDays(startOfDay(now), -27);
    const previousStart = addDays(currentStart, -28);

    const [clubResults, homeResults] = await Promise.all([
      prisma.exerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: previousStart } },
        select: {
          createdAt: true,
          calculatedScore: true,
          exercise: { select: { name: true, resultType: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: previousStart } },
        select: {
          createdAt: true,
          calculatedScore: true,
          exercise: { select: { name: true, resultType: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
    ]);

    const allResults: TrendResult[] = [...clubResults, ...homeResults];
    const currentResults = allResults.filter((item) => item.createdAt >= currentStart);
    const previousResults = allResults.filter((item) => item.createdAt >= previousStart && item.createdAt < currentStart);
    const current = summarize(currentResults);
    const previous = summarize(previousResults);

    const currentByExercise = new Map<string, number[]>();
    const previousByExercise = new Map<string, number[]>();
    for (const item of currentResults) {
      if (item.calculatedScore === null) continue;
      const values = currentByExercise.get(item.exercise.name) ?? [];
      values.push(item.calculatedScore);
      currentByExercise.set(item.exercise.name, values);
    }
    for (const item of previousResults) {
      if (item.calculatedScore === null) continue;
      const values = previousByExercise.get(item.exercise.name) ?? [];
      values.push(item.calculatedScore);
      previousByExercise.set(item.exercise.name, values);
    }

    let bestImprovement: { exercise: string; currentAverage: number; previousAverage: number; delta: number } | null = null;
    for (const [exercise, values] of currentByExercise) {
      const oldValues = previousByExercise.get(exercise);
      if (!oldValues?.length || values.length < 2) continue;
      const currentAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
      const previousAverage = oldValues.reduce((sum, value) => sum + value, 0) / oldValues.length;
      const improvement = currentAverage - previousAverage;
      if (!bestImprovement || improvement > bestImprovement.delta) {
        bestImprovement = { exercise, currentAverage, previousAverage, delta: improvement };
      }
    }

    const currentWeek = startOfWeek(now);
    const weeks = Array.from({ length: 8 }, (_, index) => {
      const start = addDays(currentWeek, (index - 7) * 7);
      const end = addDays(start, 7);
      const values = allResults.filter((item) => item.createdAt >= start && item.createdAt < end);
      const scored = values.map((item) => item.calculatedScore).filter((value): value is number => value !== null);
      return {
        key: dayKey(start),
        label: index === 7 ? "Jetzt" : start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
        results: values.length,
        activeDays: new Set(values.map((item) => dayKey(item.createdAt))).size,
        average: scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null,
      };
    });

    return NextResponse.json({
      current,
      previous,
      deltas: {
        results: current.results - previous.results,
        activeDays: current.activeDays - previous.activeDays,
        average: delta(current.average, previous.average),
        best: delta(current.best, previous.best),
        checkoutRate: delta(current.checkoutRate, previous.checkoutRate),
      },
      bestImprovement,
      weeks,
      period: {
        current: `${currentStart.toLocaleDateString("de-DE")} – ${now.toLocaleDateString("de-DE")}`,
        previous: `${previousStart.toLocaleDateString("de-DE")} – ${addDays(currentStart, -1).toLocaleDateString("de-DE")}`,
      },
    });
  } catch (error) {
    console.error("Home trends GET failed", error);
    return NextResponse.json({ error: "Leistungstrends konnten nicht geladen werden." }, { status: 500 });
  }
}
