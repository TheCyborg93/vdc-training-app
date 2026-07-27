import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const METRICS = ["WEEKLY_SESSIONS", "MONTHLY_RESULTS", "CHECKOUT_RATE", "BEST_SCORE", "WEEK_STREAK"] as const;
const STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
type GoalMetric = (typeof METRICS)[number];
type GoalStatus = (typeof STATUSES)[number];

type GoalRow = {
  id: number;
  playerId: number;
  title: string;
  metric: GoalMetric;
  targetValue: number;
  startAt: Date;
  targetAt: Date | null;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
};

type ResultItem = { createdAt: Date; calculatedScore: number | null; exercise: { resultType: string } };

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function dayKey(value: Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function weekKey(value: Date) {
  return dayKey(startOfWeek(value));
}

function clampPercent(current: number, target: number) {
  return Math.min(100, Math.max(0, Math.round((current / Math.max(target, 1)) * 100)));
}

async function readGoals(playerId: number) {
  return prisma.$queryRaw<GoalRow[]>(Prisma.sql`
    SELECT "id", "playerId", "title", "metric", "targetValue", "startAt", "targetAt", "status", "createdAt", "updatedAt"
    FROM "PlayerGoal"
    WHERE "playerId" = ${playerId}
    ORDER BY CASE WHEN "status" = 'ACTIVE' THEN 0 WHEN "status" = 'COMPLETED' THEN 1 ELSE 2 END, "createdAt" DESC
  `);
}

async function enrichGoals(playerId: number, goals: GoalRow[]) {
  if (!goals.length) return [];
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 370);
  const earliestGoal = goals.reduce((date, goal) => goal.startAt < date ? goal.startAt : date, new Date());
  const since = earliestGoal < oneYearAgo ? earliestGoal : oneYearAgo;

  const [clubResults, homeResults, completedSessions] = await Promise.all([
    prisma.exerciseResult.findMany({
      where: { playerId, deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true, calculatedScore: true, exercise: { select: { resultType: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.homeExerciseResult.findMany({
      where: { playerId, deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true, calculatedScore: true, exercise: { select: { resultType: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.homeTrainingSession.findMany({
      where: { playerId, status: "COMPLETED", completedAt: { gte: since } },
      select: { completedAt: true },
      orderBy: { completedAt: "asc" },
      take: 1000,
    }),
  ]);

  const results: ResultItem[] = [...clubResults, ...homeResults];
  const activityDays = new Set(results.map((item) => dayKey(item.createdAt)));
  for (const session of completedSessions) if (session.completedAt) activityDays.add(dayKey(session.completedAt));

  const currentWeekStart = startOfWeek(new Date());
  const currentMonthStart = startOfMonth(new Date());
  const weeklySessions = Array.from(activityDays).filter((key) => new Date(`${key}T12:00:00`) >= currentWeekStart).length;
  const monthlyResults = results.filter((item) => item.createdAt >= currentMonthStart).length;

  let weekStreak = 0;
  for (let offset = 0; offset < 53; offset += 1) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() - offset * 7);
    const active = Array.from(activityDays).some((key) => weekKey(new Date(`${key}T12:00:00`)) === weekKey(date));
    if (!active && offset === 0) continue;
    if (!active) break;
    weekStreak += 1;
  }

  return goals.map((goal) => {
    const until = goal.targetAt && goal.targetAt < new Date() ? goal.targetAt : new Date();
    const periodResults = results.filter((item) => item.createdAt >= goal.startAt && item.createdAt <= until);
    let current = 0;
    let unit = "";

    if (goal.metric === "WEEKLY_SESSIONS") {
      current = weeklySessions;
      unit = "Einheiten diese Woche";
    } else if (goal.metric === "MONTHLY_RESULTS") {
      current = monthlyResults;
      unit = "Ergebnisse diesen Monat";
    } else if (goal.metric === "CHECKOUT_RATE") {
      const checkout = periodResults.filter((item) => item.exercise.resultType === "CHECKOUT");
      current = checkout.length ? (checkout.filter((item) => item.calculatedScore === 1).length / checkout.length) * 100 : 0;
      unit = "% Checkoutquote";
    } else if (goal.metric === "BEST_SCORE") {
      current = Math.max(0, ...periodResults.map((item) => item.calculatedScore ?? 0));
      unit = "Punkte";
    } else {
      current = weekStreak;
      unit = "Wochen in Folge";
    }

    const achieved = current >= goal.targetValue;
    const expired = Boolean(goal.targetAt && goal.targetAt < new Date() && !achieved);
    return {
      ...goal,
      currentValue: Number(current.toFixed(goal.metric === "CHECKOUT_RATE" ? 1 : 0)),
      progress: clampPercent(current, goal.targetValue),
      achieved,
      expired,
      unit,
    };
  });
}

function validMetric(value: unknown): value is GoalMetric {
  return typeof value === "string" && METRICS.includes(value as GoalMetric);
}

function validStatus(value: unknown): value is GoalStatus {
  return typeof value === "string" && STATUSES.includes(value as GoalStatus);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    const goals = await readGoals(playerId);
    return NextResponse.json({ goals: await enrichGoals(playerId, goals) });
  } catch (error) {
    console.error("Player goals GET failed", error);
    return NextResponse.json({ error: "Persönliche Ziele konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = Number(body.playerId);
    const title = String(body.title ?? "").trim().slice(0, 100);
    const targetValue = Number(body.targetValue);
    const targetAt = body.targetAt ? new Date(body.targetAt) : null;
    if (!Number.isInteger(playerId) || !title || !validMetric(body.metric) || !Number.isFinite(targetValue) || targetValue <= 0 || (targetAt && Number.isNaN(targetAt.getTime()))) {
      return NextResponse.json({ error: "Bitte alle Zielangaben prüfen." }, { status: 400 });
    }

    const activeCount = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS "count" FROM "PlayerGoal" WHERE "playerId" = ${playerId} AND "status" = 'ACTIVE'`);
    if (Number(activeCount[0]?.count ?? 0) >= 8) return NextResponse.json({ error: "Maximal acht aktive Ziele sind möglich." }, { status: 409 });

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "PlayerGoal" ("playerId", "title", "metric", "targetValue", "targetAt", "updatedAt")
      VALUES (${playerId}, ${title}, ${body.metric}, ${targetValue}, ${targetAt}, CURRENT_TIMESTAMP)
    `);
    const goals = await readGoals(playerId);
    return NextResponse.json({ goals: await enrichGoals(playerId, goals) }, { status: 201 });
  } catch (error) {
    console.error("Player goals POST failed", error);
    return NextResponse.json({ error: "Ziel konnte nicht erstellt werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Ziel fehlt." }, { status: 400 });
    const existing = await prisma.$queryRaw<GoalRow[]>(Prisma.sql`SELECT * FROM "PlayerGoal" WHERE "id" = ${id} LIMIT 1`);
    const goal = existing[0];
    if (!goal) return NextResponse.json({ error: "Ziel wurde nicht gefunden." }, { status: 404 });

    const title = body.title === undefined ? goal.title : String(body.title).trim().slice(0, 100);
    const targetValue = body.targetValue === undefined ? goal.targetValue : Number(body.targetValue);
    const status = body.status === undefined ? goal.status : body.status;
    const targetAt = body.targetAt === undefined ? goal.targetAt : body.targetAt ? new Date(body.targetAt) : null;
    if (!title || !Number.isFinite(targetValue) || targetValue <= 0 || !validStatus(status) || (targetAt && Number.isNaN(targetAt.getTime()))) {
      return NextResponse.json({ error: "Zielangaben sind ungültig." }, { status: 400 });
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE "PlayerGoal"
      SET "title" = ${title}, "targetValue" = ${targetValue}, "targetAt" = ${targetAt}, "status" = ${status}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `);
    const goals = await readGoals(goal.playerId);
    return NextResponse.json({ goals: await enrichGoals(goal.playerId, goals) });
  } catch (error) {
    console.error("Player goals PATCH failed", error);
    return NextResponse.json({ error: "Ziel konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Ziel fehlt." }, { status: 400 });
    const existing = await prisma.$queryRaw<{ playerId: number }[]>(Prisma.sql`SELECT "playerId" FROM "PlayerGoal" WHERE "id" = ${id} LIMIT 1`);
    if (!existing[0]) return NextResponse.json({ error: "Ziel wurde nicht gefunden." }, { status: 404 });
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "PlayerGoal" WHERE "id" = ${id}`);
    const goals = await readGoals(existing[0].playerId);
    return NextResponse.json({ goals: await enrichGoals(existing[0].playerId, goals) });
  } catch (error) {
    console.error("Player goals DELETE failed", error);
    return NextResponse.json({ error: "Ziel konnte nicht gelöscht werden." }, { status: 500 });
  }
}
