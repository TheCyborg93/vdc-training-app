import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const preferredRegion = "lhr1";
export const dynamic = "force-dynamic";

type CompactResult = {
  playerId: number;
  exerciseId: number;
  calculatedScore: number | null;
  createdAt: Date;
  player: { displayName: string };
  exercise: { name: string };
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 55);
    since.setHours(0, 0, 0, 0);

    const [clubResults, homeResults, openHomeSessions, homePlanCount] = await Promise.all([
      prisma.exerciseResult.findMany({
        where: { deletedAt: null, createdAt: { gte: since } },
        select: {
          playerId: true,
          exerciseId: true,
          calculatedScore: true,
          createdAt: true,
          player: { select: { displayName: true } },
          exercise: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1200,
      }),
      prisma.homeExerciseResult.findMany({
        where: { deletedAt: null, createdAt: { gte: since } },
        select: {
          playerId: true,
          exerciseId: true,
          calculatedScore: true,
          createdAt: true,
          player: { select: { displayName: true } },
          exercise: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1200,
      }),
      prisma.homeTrainingSession.count({ where: { status: { in: ["RUNNING", "PAUSED"] } } }),
      prisma.homeTrainingPlan.count(),
    ]);

    const results = [...clubResults, ...homeResults] as CompactResult[];
    const playerMap = new Map<number, { playerId: number; name: string; count: number; scores: number[]; days: Set<string> }>();
    const exerciseMap = new Map<number, { exerciseId: number; name: string; count: number; players: Set<number> }>();
    const dayMap = new Map<string, number>();

    for (const item of results) {
      const player = playerMap.get(item.playerId) ?? {
        playerId: item.playerId,
        name: item.player.displayName,
        count: 0,
        scores: [],
        days: new Set<string>(),
      };
      player.count += 1;
      player.days.add(dateKey(item.createdAt));
      if (item.calculatedScore !== null && Number.isFinite(item.calculatedScore)) player.scores.push(item.calculatedScore);
      playerMap.set(item.playerId, player);

      const exercise = exerciseMap.get(item.exerciseId) ?? {
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        count: 0,
        players: new Set<number>(),
      };
      exercise.count += 1;
      exercise.players.add(item.playerId);
      exerciseMap.set(item.exerciseId, exercise);

      const key = dateKey(item.createdAt);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }

    const topPlayers = [...playerMap.values()]
      .map((item) => ({
        playerId: item.playerId,
        name: item.name,
        results: item.count,
        activeDays: item.days.size,
        average: item.scores.length ? item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length : null,
      }))
      .sort((a, b) => b.activeDays - a.activeDays || b.results - a.results)
      .slice(0, 5);

    const topExercises = [...exerciseMap.values()]
      .map((item) => ({ exerciseId: item.exerciseId, name: item.name, results: item.count, players: item.players.size }))
      .sort((a, b) => b.results - a.results)
      .slice(0, 5);

    const heatmap = Array.from({ length: 56 }, (_, index) => {
      const date = new Date(since);
      date.setDate(since.getDate() + index);
      const key = dateKey(date);
      return { date: key, count: dayMap.get(key) ?? 0 };
    });

    return NextResponse.json(
      {
        topPlayers,
        topExercises,
        heatmap,
        homeTraining: { openSessions: openHomeSessions, plans: homePlanCount },
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("Dashboard insights GET failed", error);
    return NextResponse.json({ error: "Dashboard-Auswertung konnte nicht geladen werden." }, { status: 500 });
  }
}
