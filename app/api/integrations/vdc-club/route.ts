import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function weekKey(value: Date): string {
  const monday = new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const expectedToken = process.env.VDC_CLUB_SYNC_TOKEN?.trim();

  if (!expectedToken || expectedToken.length < 32) {
    return NextResponse.json(
      { ok: false, error: "sync_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!suppliedToken || !safeEqual(suppliedToken, expectedToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const [trainingDays, players] = await Promise.all([
      prisma.trainingDay.findMany({
        where: {
          status: { in: ["PUBLISHED", "RUNNING", "COMPLETED"] },
        },
        orderBy: { trainingDate: "desc" },
        take: 30,
        include: {
          trainingPlan: {
            include: {
              exercises: {
                orderBy: { position: "asc" },
                include: { exercise: true },
              },
            },
          },
          players: {
            include: { player: true },
          },
          boards: {
            include: { board: true },
          },
        },
      }),
      prisma.player.findMany({
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
      }),
    ]);

    const days = trainingDays.map((day) => ({
      id: day.id,
      trainingDate: day.trainingDate.toISOString(),
      status: day.status,
      plan: {
        id: day.trainingPlan.id,
        title: day.trainingPlan.title,
        goal: day.trainingPlan.goal,
        durationMin: day.trainingPlan.durationMin,
        exercises: day.trainingPlan.exercises.map((item) => ({
          id: item.exercise.id,
          name: item.exercise.name,
          durationMin: item.durationMin,
          position: item.position,
        })),
      },
      players: day.players.map((entry) => ({
        id: entry.player.id,
        displayName: entry.player.displayName,
      })),
      boards: day.boards.map((entry) => ({
        id: entry.board.id,
        name: entry.board.name,
      })),
    }));

    const statistics = players.map((player) => {
      const scoredResults = player.results
        .map((result) => result.calculatedScore)
        .filter((value): value is number => value !== null && Number.isFinite(value));

      const trainingDayIds = new Set(
        player.results.map((result) => result.boardSession.trainingDayId),
      );

      const checkoutResults = player.results.filter(
        (result) => result.exercise.resultType === "CHECKOUT",
      );
      const successfulCheckouts = checkoutResults.filter(
        (result) => Boolean(asRecord(result.valueJson).success),
      ).length;

      const scoringResults = player.results.filter(
        (result) => result.exercise.resultType === "SCORE_0_TO_180",
      );
      const scoringVisits = scoringResults.flatMap((result) => {
        const visits = asRecord(result.valueJson).visits;
        return Array.isArray(visits)
          ? visits.map(Number).filter(Number.isFinite)
          : [];
      });

      const weekly = new Map<string, {
        scoring: number[];
        checkoutAttempts: number;
        checkoutSuccesses: number;
        results: number;
      }>();

      for (const result of player.results) {
        const key = weekKey(result.createdAt);
        const bucket = weekly.get(key) ?? {
          scoring: [],
          checkoutAttempts: 0,
          checkoutSuccesses: 0,
          results: 0,
        };

        bucket.results += 1;

        if (result.exercise.resultType === "SCORE_0_TO_180") {
          const visits = asRecord(result.valueJson).visits;
          if (Array.isArray(visits)) {
            bucket.scoring.push(...visits.map(Number).filter(Number.isFinite));
          }
        }

        if (result.exercise.resultType === "CHECKOUT") {
          bucket.checkoutAttempts += 1;
          if (Boolean(asRecord(result.valueJson).success)) {
            bucket.checkoutSuccesses += 1;
          }
        }

        weekly.set(key, bucket);
      }

      const trend = [...weekly.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-12)
        .map(([week, bucket]) => ({
          week,
          scoringAverage: average(bucket.scoring),
          checkoutRate: bucket.checkoutAttempts
            ? Number(((bucket.checkoutSuccesses / bucket.checkoutAttempts) * 100).toFixed(1))
            : null,
          results: bucket.results,
        }));

      return {
        id: player.id,
        displayName: player.displayName,
        trainingDays: trainingDayIds.size,
        completedExercises: player.results.length,
        overallAverage: average(scoredResults),
        personalBest: scoredResults.length ? Math.max(...scoredResults) : null,
        checkoutRate: checkoutResults.length
          ? Number(((successfulCheckouts / checkoutResults.length) * 100).toFixed(1))
          : null,
        scoringAverage: average(scoringVisits),
        scores100: scoringVisits.filter((value) => value >= 100).length,
        scores140: scoringVisits.filter((value) => value >= 140).length,
        scores180: scoringVisits.filter((value) => value === 180).length,
        trend,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        version: 2,
        generatedAt: new Date().toISOString(),
        trainingDays: days,
        playerStatistics: statistics,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("VDC Club training sync failed", error);
    return NextResponse.json(
      { ok: false, error: "training_sync_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
