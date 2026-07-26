import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function durationMinutes(startedAt: Date, completedAt: Date | null) {
  if (!completedAt) return 0;
  return Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    }

    const [sessions, bestResults] = await Promise.all([
      prisma.homeTrainingSession.findMany({
        where: { playerId, status: "COMPLETED" },
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          plan: { select: { title: true, goal: true, durationMin: true } },
          results: {
            where: { deletedAt: null },
            select: {
              id: true,
              calculatedScore: true,
              createdAt: true,
              exercise: { select: { name: true, resultType: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { completedAt: "desc" },
        take: 10,
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null, calculatedScore: { not: null } },
        select: {
          calculatedScore: true,
          createdAt: true,
          exercise: { select: { name: true, resultType: true } },
        },
        orderBy: { calculatedScore: "desc" },
        take: 100,
      }),
    ]);

    const recent = sessions.map((session) => {
      const scored = session.results.filter((result) => result.calculatedScore !== null);
      const strongest = scored.reduce<typeof scored[number] | null>((best, result) => {
        if (!best) return result;
        return Number(result.calculatedScore) > Number(best.calculatedScore) ? result : best;
      }, null);
      return {
        id: session.id,
        title: session.plan.title,
        goal: session.plan.goal,
        plannedMinutes: session.plan.durationMin,
        actualMinutes: durationMinutes(session.startedAt, session.completedAt),
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        resultCount: session.results.length,
        exerciseCount: new Set(session.results.map((result) => result.exercise.name)).size,
        strongest: strongest
          ? { exercise: strongest.exercise.name, score: strongest.calculatedScore, resultType: strongest.exercise.resultType }
          : null,
      };
    });

    const uniqueBest = new Map<string, { exercise: string; score: number; resultType: string; createdAt: Date }>();
    for (const result of bestResults) {
      if (result.calculatedScore === null) continue;
      if (!uniqueBest.has(result.exercise.name)) {
        uniqueBest.set(result.exercise.name, {
          exercise: result.exercise.name,
          score: result.calculatedScore,
          resultType: result.exercise.resultType,
          createdAt: result.createdAt,
        });
      }
    }

    return NextResponse.json({
      summary: {
        sessions: recent.length,
        minutes: recent.reduce((sum, session) => sum + session.actualMinutes, 0),
        results: recent.reduce((sum, session) => sum + session.resultCount, 0),
        averageMinutes: recent.length ? Math.round(recent.reduce((sum, session) => sum + session.actualMinutes, 0) / recent.length) : 0,
      },
      sessions: recent,
      bestResults: Array.from(uniqueBest.values()).slice(0, 6),
    });
  } catch (error) {
    console.error("Home history GET failed", error);
    return NextResponse.json({ error: "Trainingshistorie konnte nicht geladen werden." }, { status: 500 });
  }
}
