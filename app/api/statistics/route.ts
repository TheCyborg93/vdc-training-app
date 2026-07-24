import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      include: {
        results: {
          orderBy: { createdAt: "asc" },
          include: {
            exercise: true,
            boardSession: { select: { trainingDayId: true } },
          },
        },
      },
    });

    const statistics = players.map((player) => {
      const scoredResults = player.results
        .map((result) => result.calculatedScore)
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const trainingDays = new Set(player.results.map((result) => result.boardSession.trainingDayId));
      const checkoutResults = player.results.filter((result) => result.exercise.resultType === "CHECKOUT");
      const successfulCheckouts = checkoutResults.filter((result) => Boolean(asRecord(result.valueJson).success)).length;
      const scoringResults = player.results.filter((result) => result.exercise.resultType === "SCORE_0_TO_180");
      const scoringVisits = scoringResults.flatMap((result) => {
        const visits = asRecord(result.valueJson).visits;
        return Array.isArray(visits) ? visits.map(Number).filter(Number.isFinite) : [];
      });
      const hitResults = player.results.filter((result) => result.exercise.resultType === "HITS_0_TO_3");
      const hits = hitResults.map((result) => Number(asRecord(result.valueJson).hits)).filter(Number.isFinite);
      const dated = player.results.map((result) => ({
        date: result.createdAt.toISOString(),
        exercise: result.exercise.name,
        type: result.exercise.resultType,
        score: result.calculatedScore,
      }));

      return {
        id: player.id,
        displayName: player.displayName,
        trainingDays: trainingDays.size,
        completedExercises: player.results.length,
        overallAverage: average(scoredResults),
        personalBest: scoredResults.length ? Math.max(...scoredResults) : null,
        lastValue: scoredResults.length ? scoredResults[scoredResults.length - 1] : null,
        checkout: {
          attempts: checkoutResults.length,
          successes: successfulCheckouts,
          rate: checkoutResults.length ? Number(((successfulCheckouts / checkoutResults.length) * 100).toFixed(1)) : null,
        },
        scoring: {
          visits: scoringVisits.length,
          average: average(scoringVisits),
          highScore: scoringVisits.length ? Math.max(...scoringVisits) : null,
          scores100: scoringVisits.filter((value) => value >= 100).length,
          scores140: scoringVisits.filter((value) => value >= 140).length,
          scores180: scoringVisits.filter((value) => value === 180).length,
        },
        hits: {
          rounds: hits.length,
          average: average(hits),
          total: hits.reduce((sum, value) => sum + value, 0),
        },
        history: dated.slice(-20),
      };
    });

    return NextResponse.json({ players: statistics });
  } catch (error) {
    console.error("Statistics GET failed", error);
    return NextResponse.json({ error: "Statistiken konnten nicht geladen werden." }, { status: 500 });
  }
}
