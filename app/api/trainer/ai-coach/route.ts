import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCoachProfile,
  CLUB_TRAINING_SESSIONS_PER_WEEK,
  type CoachArea,
  type CoachResultInput,
} from "@/lib/ai-coach";

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

const focusExercises: Record<TrainingFocus, string[]> = {
  SCORING: ["100 Darts at 20", "Sniper - High Scoring", "Switch - 20 & 19"],
  CHECKOUT: ["Catch 40 - Bereich 61 bis 70", "121 - The Checkout Game", "Random Checkout"],
  DOUBLES: ["Bob's 27 - Classic", "Double Lock - D16", "Double Lock - D20"],
  BULL: ["Bullseye Challenge", "100 Darts at Bullseye", "Finish 50 (Bull)"],
  OTHER: ["Around the Clock - Singles (Vorwärts)", "Halve It - Track 3", "Black & White"],
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
    SCORING: { title: "Scoring-Woche", description: "Sammle über die zwei Trainingstage gezielte Scoring-Aufnahmen.", target: 12, unit: "Aufnahmen" },
    CHECKOUT: { title: "Checkout-Fokus", description: "Dokumentiere an beiden Trainingstagen klare Checkout-Versuche.", target: 10, unit: "Versuche" },
    DOUBLES: { title: "Doppel-Mission", description: "Arbeite in beiden Wochenblöcken an deinen bevorzugten Doppeln.", target: 12, unit: "Aufnahmen" },
    BULL: { title: "Bull-Control", description: "Sammle kontrollierte Aufnahmen auf Single- und Double-Bull.", target: 10, unit: "Aufnahmen" },
    CONSISTENCY: { title: "Konstanz-Serie", description: "Nimm an beiden regulären Trainingstagen teil und schließe mindestens eine Übung ab.", target: CLUB_TRAINING_SESSIONS_PER_WEEK, unit: "Trainingstage" },
    TRAINING: { title: "Trainingsroutine", description: "Erreiche den Vereinsrhythmus von zwei Trainingstagen in dieser Woche.", target: CLUB_TRAINING_SESSIONS_PER_WEEK, unit: "Trainingstage" },
  };

  const definition = definitions[area];
  const progress = area === "CONSISTENCY" || area === "TRAINING" ? activeDaysLast7 : matching;
  return { area, ...definition, progress: Math.min(progress, definition.target), completed: progress >= definition.target };
}

function weeklyPlan(balance: { key: TrainingFocus; label: string; percentage: number }[]) {
  const focusOrder = balance
    .filter((item) => item.key !== "OTHER")
    .sort((a, b) => a.percentage - b.percentage)
    .map((item) => item.key);
  const first = focusOrder[0] ?? "CHECKOUT";
  const second = focusOrder.find((item) => item !== first) ?? "DOUBLES";
  return [
    {
      session: 1,
      title: `Training A · ${focusLabels[first]}`,
      focus: focusLabels[first],
      purpose: "Größten untertrainierten Bereich gezielt bearbeiten.",
      exercises: focusExercises[first],
    },
    {
      session: 2,
      title: `Training B · ${focusLabels[second]} & Matchtransfer`,
      focus: focusLabels[second],
      purpose: "Zweiten Schwerpunkt festigen und unter Druck in eine wettkampfnähere Übung übertragen.",
      exercises: [...focusExercises[second].slice(0, 2), "501 - Single In / Double Out"],
    },
  ];
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
      schedule: { sessionsPerWeek: CLUB_TRAINING_SESSIONS_PER_WEEK },
      overview: { players: profiles.length, improving, declining, analyzedResults: combined.length, focus },
      trainingIntelligence: {
        periodDays: 30,
        balance: trainingBalance,
        undertrained,
        overtrained,
        recommendation: undertrained.length
          ? `Bei zwei Trainingstagen pro Woche sollte Training A ${undertrained[0]?.label} und Training B ${undertrained[1]?.label ?? "Matchtransfer"} priorisieren.`
          : "Die beiden wöchentlichen Trainingstermine sind aktuell ausgewogen verteilt.",
        weeklyPlan: weeklyPlan(trainingBalance),
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
