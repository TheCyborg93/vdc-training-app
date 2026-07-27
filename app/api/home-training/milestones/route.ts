import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Milestone = {
  key: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  unlocked: boolean;
};

function milestone(key: string, title: string, description: string, current: number, target: number, unit: string): Milestone {
  return { key, title, description, current, target, unit, unlocked: current >= target };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    }

    const [clubResults, homeResults, completedSessions] = await Promise.all([
      prisma.exerciseResult.findMany({
        where: { playerId, deletedAt: null },
        select: { createdAt: true, calculatedScore: true },
        orderBy: { createdAt: "desc" },
        take: 800,
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null },
        select: { createdAt: true, calculatedScore: true },
        orderBy: { createdAt: "desc" },
        take: 800,
      }),
      prisma.homeTrainingSession.findMany({
        where: { playerId, status: "COMPLETED" },
        select: { completedAt: true, startedAt: true },
        orderBy: { completedAt: "desc" },
        take: 250,
      }),
    ]);

    const allResults = [...clubResults, ...homeResults];
    const activityDays = new Set(allResults.map((result) => result.createdAt.toISOString().slice(0, 10)));
    for (const session of completedSessions) {
      if (session.completedAt) activityDays.add(session.completedAt.toISOString().slice(0, 10));
    }

    const scored = allResults
      .map((result) => result.calculatedScore)
      .filter((value): value is number => value !== null);
    const bestScore = scored.length ? Math.max(...scored) : 0;
    const totalMinutes = completedSessions.reduce((sum, session) => {
      if (!session.completedAt) return sum;
      return sum + Math.max(0, Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 60000));
    }, 0);

    const milestones: Milestone[] = [
      milestone("first-session", "Erster Schritt", "Schließe dein erstes Heimtraining ab.", completedSessions.length, 1, "Einheit"),
      milestone("five-sessions", "Trainingsroutine", "Schließe fünf Heimtrainings ab.", completedSessions.length, 5, "Einheiten"),
      milestone("twenty-sessions", "Konsequenz", "Schließe 20 Heimtrainings ab.", completedSessions.length, 20, "Einheiten"),
      milestone("hundred-results", "100 Aufnahmen", "Speichere insgesamt 100 Trainingsergebnisse.", allResults.length, 100, "Ergebnisse"),
      milestone("five-hundred-results", "Datenmaschine", "Speichere insgesamt 500 Trainingsergebnisse.", allResults.length, 500, "Ergebnisse"),
      milestone("ten-days", "Zehn Trainingstage", "Trainiere an zehn unterschiedlichen Tagen.", activityDays.size, 10, "Tage"),
      milestone("thirty-days", "Im Rhythmus", "Trainiere an 30 unterschiedlichen Tagen.", activityDays.size, 30, "Tage"),
      milestone("ten-hours", "Zehn Stunden", "Absolviere zehn Stunden Heimtraining.", totalMinutes, 600, "Minuten"),
      milestone("score-100", "Dreistellig", "Erreiche einen gewerteten Wert von mindestens 100.", bestScore, 100, "Punkte"),
      milestone("score-180", "Maximum", "Erreiche einen gewerteten Wert von 180.", bestScore, 180, "Punkte"),
    ];

    const unlocked = milestones.filter((item) => item.unlocked).length;
    const next = milestones.find((item) => !item.unlocked) ?? null;

    return NextResponse.json({
      summary: {
        unlocked,
        total: milestones.length,
        activityDays: activityDays.size,
        completedSessions: completedSessions.length,
        totalResults: allResults.length,
        totalMinutes,
        bestScore,
      },
      next,
      milestones,
    });
  } catch (error) {
    console.error("Home milestones GET failed", error);
    return NextResponse.json({ error: "Meilensteine konnten nicht geladen werden." }, { status: 500 });
  }
}
