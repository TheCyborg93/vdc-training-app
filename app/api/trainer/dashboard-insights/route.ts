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

    const last14Days = new Date(now);
    last14Days.setDate(last14Days.getDate() - 13);
    last14Days.setHours(0, 0, 0, 0);

    const inactivityLimit = new Date(now);
    inactivityLimit.setDate(inactivityLimit.getDate() - 27);
    inactivityLimit.setHours(0, 0, 0, 0);

    const staleHomeLimit = new Date(now);
    staleHomeLimit.setDate(staleHomeLimit.getDate() - 7);

    const [
      clubResults,
      homeResults,
      openHomeSessions,
      homePlanCount,
      completedTrainingDays,
      activePlayers,
      staleHomeSessions,
      draftPlans,
    ] = await Promise.all([
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
      prisma.trainingDay.findMany({
        where: { status: "COMPLETED", trainingDate: { gte: last14Days } },
        select: { trainingDate: true },
        orderBy: { trainingDate: "asc" },
      }),
      prisma.player.findMany({
        where: { active: true },
        select: { id: true, displayName: true },
      }),
      prisma.homeTrainingSession.count({
        where: { status: { in: ["RUNNING", "PAUSED"] }, updatedAt: { lt: staleHomeLimit } },
      }),
      prisma.trainingPlan.count({ where: { status: "DRAFT" } }),
    ]);

    const results = [...clubResults, ...homeResults] as CompactResult[];
    const playerMap = new Map<number, { playerId: number; name: string; count: number; scores: number[]; days: Set<string> }>();
    const exerciseMap = new Map<number, { exerciseId: number; name: string; count: number; players: Set<number> }>();
    const dayMap = new Map<string, number>();
    const recentlyActivePlayers = new Set<number>();

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

      if (item.createdAt >= inactivityLimit) recentlyActivePlayers.add(item.playerId);

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

    const completedTrainingDates = new Set(completedTrainingDays.map((item) => dateKey(item.trainingDate)));
    const completedLast14Days = completedTrainingDates.size;
    const expectedLast14Days = 4;
    const inactivePlayers = activePlayers
      .filter((player) => !recentlyActivePlayers.has(player.id))
      .slice(0, 5)
      .map((player) => ({ playerId: player.id, name: player.displayName }));

    const alerts: { level: "success" | "warning" | "critical"; title: string; text: string; href: string }[] = [];

    if (completedLast14Days >= expectedLast14Days) {
      alerts.push({
        level: "success",
        title: "Trainingsrhythmus im Soll",
        text: `${completedLast14Days} Vereinstrainings in den letzten 14 Tagen entsprechen eurem Rhythmus von zweimal pro Woche.`,
        href: "/trainer/archiv",
      });
    } else {
      alerts.push({
        level: completedLast14Days <= 1 ? "critical" : "warning",
        title: "Trainingsrhythmus unter Soll",
        text: `${completedLast14Days} von empfohlenen ${expectedLast14Days} Vereinstrainings wurden in den letzten 14 Tagen abgeschlossen.`,
        href: "/trainer/trainingstag",
      });
    }

    if (inactivePlayers.length > 0) {
      alerts.push({
        level: "warning",
        title: `${inactivePlayers.length} Spieler ohne aktuelle Ergebnisse`,
        text: "Diese aktiven Spieler haben in den letzten 28 Tagen weder Vereins- noch Heimtrainingsergebnisse gespeichert.",
        href: "/trainer/spieler",
      });
    }

    if (staleHomeSessions > 0) {
      alerts.push({
        level: "warning",
        title: `${staleHomeSessions} Heimtraining${staleHomeSessions === 1 ? " liegt" : " liegen"} seit über 7 Tagen offen`,
        text: "Prüfe, ob die Sessions fortgesetzt, abgeschlossen oder beendet werden sollen.",
        href: "/trainer/heimtraining",
      });
    }

    if (draftPlans > 0) {
      alerts.push({
        level: "success",
        title: `${draftPlans} Trainingsplan-${draftPlans === 1 ? "Entwurf" : "Entwürfe"} vorbereitet`,
        text: "Die Entwürfe können weiter bearbeitet oder für einen Trainingstag veröffentlicht werden.",
        href: "/trainer/trainingsplaene",
      });
    }

    return NextResponse.json(
      {
        topPlayers,
        topExercises,
        heatmap,
        homeTraining: { openSessions: openHomeSessions, plans: homePlanCount, staleSessions: staleHomeSessions },
        cadence: {
          completedLast14Days,
          expectedLast14Days,
          percentage: Math.min(100, Math.round((completedLast14Days / expectedLast14Days) * 100)),
          targetPerWeek: 2,
        },
        inactivePlayers,
        alerts: alerts.slice(0, 4),
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("Dashboard insights GET failed", error);
    return NextResponse.json({ error: "Dashboard-Auswertung konnte nicht geladen werden." }, { status: 500 });
  }
}
