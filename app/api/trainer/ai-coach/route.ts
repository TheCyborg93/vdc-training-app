import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCoachProfile, type CoachResultInput } from "@/lib/ai-coach";

export const preferredRegion = "lhr1";
export const runtime = "nodejs";

type CoachResultWithPlayer = CoachResultInput & {
  playerId: number;
};

export async function GET() {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [players, clubResults, homeResults] = await Promise.all([
      prisma.player.findMany({
        where: { active: true },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true },
      }),
      prisma.exerciseResult.findMany({
        where: { deletedAt: null, createdAt: { gte: since } },
        select: {
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
        },
      }),
      prisma.homeExerciseResult.findMany({
        where: { deletedAt: null, createdAt: { gte: since } },
        select: {
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
        },
      }),
    ]);

    const combined: CoachResultWithPlayer[] = [...clubResults, ...homeResults];
    const profiles = players.map((player) => {
      const results = combined.filter((result) => result.playerId === player.id);
      const activeDays = new Set(
        results.map((result) => new Date(result.createdAt).toISOString().slice(0, 10)),
      ).size;
      return {
        playerId: player.id,
        playerName: player.displayName,
        resultCount: results.length,
        activeDays,
        ...buildCoachProfile(results, activeDays),
      };
    });

    const improving = profiles.filter((profile) => profile.areas.some((area) => area.trend >= 8)).length;
    const declining = profiles.filter((profile) => profile.areas.some((area) => area.trend <= -8)).length;
    const weakestAreas = new Map<string, number>();
    for (const profile of profiles) {
      const weakest = profile.weakest[0];
      if (weakest) weakestAreas.set(weakest.label, (weakestAreas.get(weakest.label) ?? 0) + 1);
    }
    const focus = [...weakestAreas.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        overview: { players: profiles.length, improving, declining, analyzedResults: combined.length, focus },
        profiles,
      },
      {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
      },
    );
  } catch (error) {
    console.error("AI coach GET failed", error);
    return NextResponse.json({ error: "Die Coach-Analyse konnte nicht erstellt werden." }, { status: 500 });
  }
}
