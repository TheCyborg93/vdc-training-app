import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { buildCoachProfile, type CoachResultInput } from "@/lib/ai-coach";
import { buildAdaptiveSession } from "@/lib/coach/adaptive-engine";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

type ResultWithExercise = CoachResultInput & { exerciseId: number };

function parseTags(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(request.url);
  const playerId = Number(url.searchParams.get("playerId"));
  const rawDuration = Number(url.searchParams.get("durationMin"));
  const durationMin = Number.isFinite(rawDuration) ? Math.max(30, Math.min(180, Math.round(rawDuration))) : 90;

  if (!Number.isInteger(playerId) || playerId < 1) {
    return NextResponse.json({ error: "Eine gültige Spieler-ID ist erforderlich." }, { status: 400 });
  }

  try {
    const now = Date.now();
    const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const since7 = now - 7 * 24 * 60 * 60 * 1000;

    const [player, clubResults, homeResults, exercises] = await Promise.all([
      prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, displayName: true, active: true },
      }),
      prisma.exerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since90 } },
        orderBy: { createdAt: "desc" },
        select: {
          exerciseId: true,
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
        },
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since90 } },
        orderBy: { createdAt: "desc" },
        select: {
          exerciseId: true,
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
        },
      }),
      prisma.exercise.findMany({
        where: { active: true },
        orderBy: [{ favorite: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          shortDescription: true,
          description: true,
          defaultMinutes: true,
          difficulty: true,
          intensity: true,
          engine: true,
          tagsJson: true,
          favorite: true,
          categories: { select: { category: { select: { name: true } } } },
        },
      }),
    ]);

    if (!player) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });

    const results: ResultWithExercise[] = [...clubResults, ...homeResults];
    const activeDays = new Set(results.map((result) => new Date(result.createdAt).toISOString().slice(0, 10))).size;
    const recentResults = results.filter((result) => new Date(result.createdAt).getTime() >= since7);
    const activeDaysLast7 = new Set(recentResults.map((result) => new Date(result.createdAt).toISOString().slice(0, 10))).size;
    const recentExerciseIds = [...new Set(results.slice(0, 20).map((result) => result.exerciseId))];
    const profile = buildCoachProfile(results, activeDays);

    const session = buildAdaptiveSession({
      profile,
      durationMin,
      activeDaysLast7,
      resultsLast7: recentResults.length,
      recentExerciseIds,
      exercises: exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        description: exercise.shortDescription ?? exercise.description,
        defaultMinutes: exercise.defaultMinutes,
        difficulty: exercise.difficulty,
        intensity: exercise.intensity,
        engine: String(exercise.engine),
        tags: parseTags(exercise.tagsJson),
        categories: exercise.categories.map((item) => item.category.name),
        favorite: exercise.favorite,
      })),
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      player: { id: player.id, name: player.displayName },
      dataBasis: {
        periodDays: 90,
        results: results.length,
        activeDays,
        resultsLast7: recentResults.length,
        activeDaysLast7,
      },
      profile: {
        performanceIndex: profile.performanceIndex,
        strongest: profile.strongest,
        weakest: profile.weakest,
      },
      session,
    }, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    });
  } catch (error) {
    logger.error("Adaptive coach plan failed", error, { trainerId: trainer.id, playerId, durationMin });
    return NextResponse.json({ error: "Der adaptive Trainingsplan konnte nicht erstellt werden." }, { status: 500 });
  }
}
