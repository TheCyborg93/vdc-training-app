import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCoachProfile, type CoachArea, type CoachResultInput } from "@/lib/ai-coach";

export const preferredRegion = "lhr1";
export const runtime = "nodejs";

type CoachResultWithPlayer = CoachResultInput & { playerId: number };

type TrainingFocus = "SCORING" | "CHECKOUT" | "DOUBLES" | "BULL" | "OTHER";

const focusLabels: Record<TrainingFocus, string> = {
  SCORING: "Scoring",
  CHECKOUT: "Checkout",
  DOUBLES: "Doppel",
  BULL: "Bull",
  OTHER: "Weitere Bereiche",
};

function resultWords(result: CoachResultInput) {
  const tags = Array.isArray(result.exercise.tagsJson) ? result.exercise.tagsJson.map(String) : [];
  const categories = result.exercise.categories.map((item) => item.category.name);
  return [result.exercise.name, result.exercise.engine, ...tags, ...categories].join(" ").toLowerCase();
}

function resultFocus(result: CoachResultInput): TrainingFocus {
  const words = resultWords(result);
  if (/checkout|finish|catch 40|121|170|61 in|101 in|132/.test(words)) return "CHECKOUT";
  if (/doppel|double|bob|around.*double/.test(words)) return "DOUBLES";
  if (/bull/.test(words)) return "BULL";
  if (/scoring|x01|301|501|701|treble|sniper|switch|halve|baseball|fives/.test(words)) return "SCORING";
  return "OTHER";
}

function challengeFor(area: CoachArea, recentResults: CoachResultInput[], activeDaysLast7: number) {
  const matching = recentResults.filter((result) => {
    const focus = resultFocus(result);
    if (area === "SCORING") return focus === "SCORING";
    if (area === "CHECKOUT") return focus === "CHECKOUT";
    if (area === "DOUBLES") return focus === "DOUBLES";
    if (area === "BULL") return focus === "BULL";
    return false;
  }).length;

  const definitions: Record<CoachArea, { title: string; description: string; target: number; unit: string }> = {
    SCORING: { title: "Scoring-Woche", description: "Absolviere gezielte Scoring-Aufnahmen und stabilisiere deinen Rhythmus.", target: 15, unit: "Aufnahmen" },
    CHECKOUT: { title: "Checkout-Fokus", description: "Trainiere klare Finishwege und dokumentiere jeden Checkout-Versuch.", target: 12, unit: "Versuche" },
    DOUBLES: { title: "Doppel-Mission", description: "Arbeite diese Woche regelmäßig an deinen bevorzugten Doppeln.", target: 15, unit: "Aufnahmen" },
    BULL: { title: "Bull-Control", description: "Sammle kontrollierte Aufnahmen auf Single- und Double-Bull.", target: 12, unit: "Aufnahmen" },
    CONSISTENCY: { title: "Konstanz-Serie", description: "Schließe drei kurze Trainingseinheiten an unterschiedlichen Tagen ab.", target: 3, unit: "Trainingstage" },
    TRAINING: { title: "Trainingsroutine", description: "Trainiere an drei Tagen dieser Woche mindestens eine vollständige Übung.", target: 3, unit: "Trainingstage" },
  };

  const definition = definitions[area];
  const progress = area === "CONSISTENCY" || area === "TRAINING" ? activeDaysLast7 : matching;
  return { area, ...definition, progress: Math.min(progress, definition.target), completed: progress >= definition.target };
}

export async function GET() {
  try {
    const now = Date.now();
    const since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const last30 = now - 30 * 24 * 60 * 60 * 1000;
    const last7 = now - 7 * 24 * 60 * 60 * 1000;
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
      const activeDays = new Set(results.map((result) => new Date(result.createdAt).toISOString().slice(0, 10))).size;
      const recentResults = results.filter((result) => new Date(result.createdAt).getTime() >= last7);
      const activeDaysLast7 = new Set(recentResults.map((result) => new Date(result.createdAt).toISOString().slice(0, 10))).size;
      const coachProfile = buildCoachProfile(results, activeDays);
      const challengeArea = coachProfile.weakest[0]?.key ?? "TRAINING";
      return {
        playerId: player.id,
        playerName: player.displayName,
        resultCount: results.length,
        activeDays,
        ...coachProfile,
        weeklyChallenge: challengeFor(challengeArea, recentResults, activeDaysLast7),
      };
    });

    const improving = profiles.filter((profile) => profile.areas.some((area) => area.trend >= 8)).length;
    const declining = profiles.filter((profile) => profile.areas.some((area) => area.trend <= -8)).length;
    const weakestAreas = new Map<string, number>();
    for (const profile of profiles) {
      const weakest = profile.weakest[0];
      if (weakest) weakestAreas.set(weakest.label, (weakestAreas.get(weakest.label) ?? 0) + 1);
    }
    const focus = [...weakestAreas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => ({ label, count }));

    const recent30Results = combined.filter((result) => new Date(result.createdAt).getTime() >= last30);
    const focusCounts = new Map<TrainingFocus, number>();
    for (const key of Object.keys(focusLabels) as TrainingFocus[]) focusCounts.set(key, 0);
    for (const result of recent30Results) {
      const key = resultFocus(result);
      focusCounts.set(key, (focusCounts.get(key) ?? 0) + 1);
    }
    const totalRecent = recent30Results.length || 1;
    const trainingBalance = [...focusCounts.entries()].map(([key, count]) => ({
      key,
      label: focusLabels[key],
      count,
      percentage: Math.round(count / totalRecent * 100),
    })).sort((a, b) => b.percentage - a.percentage);
    const undertrained = trainingBalance.filter((item) => item.key !== "OTHER" && item.percentage < 15).slice(0, 2);
    const overtrained = trainingBalance.filter((item) => item.key !== "OTHER" && item.percentage > 45).slice(0, 1);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: { players: profiles.length, improving, declining, analyzedResults: combined.length, focus },
      trainingIntelligence: {
        periodDays: 30,
        balance: trainingBalance,
        undertrained,
        overtrained,
        recommendation: undertrained.length
          ? `Das nächste Vereinstraining sollte ${undertrained.map((item) => item.label).join(" und ")} stärker berücksichtigen.`
          : "Die Trainingsschwerpunkte sind aktuell ausgewogen verteilt.",
      },
      profiles,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("AI coach GET failed", error);
    return NextResponse.json({ error: "Die Coach-Analyse konnte nicht erstellt werden." }, { status: 500 });
  }
}
