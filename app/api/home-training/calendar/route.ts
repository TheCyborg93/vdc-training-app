import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ScheduleRow = {
  id: number;
  playerId: number;
  homeTrainingPlanId: number | null;
  scheduledFor: Date;
  note: string | null;
  completed: boolean;
  planTitle: string | null;
  planGoal: string | null;
  durationMin: number | null;
};

function parseMonth(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const rangeStart = new Date(start);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  const rangeEnd = new Date(end);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
  return { start, end, rangeStart, rangeEnd };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    const range = parseMonth(searchParams.get("month"));
    if (!Number.isInteger(playerId) || !range) {
      return NextResponse.json({ error: "Spieler oder Monat fehlt." }, { status: 400 });
    }

    const [clubDays, homeSessions, schedules, plans] = await Promise.all([
      prisma.trainingDay.findMany({
        where: {
          trainingDate: { gte: range.rangeStart, lt: range.rangeEnd },
          status: { in: ["PUBLISHED", "RUNNING", "COMPLETED"] },
          players: { some: { playerId } },
        },
        select: {
          id: true,
          trainingDate: true,
          status: true,
          trainingPlan: { select: { title: true, goal: true, durationMin: true } },
        },
        orderBy: { trainingDate: "asc" },
      }),
      prisma.homeTrainingSession.findMany({
        where: {
          playerId,
          startedAt: { gte: range.rangeStart, lt: range.rangeEnd },
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          plan: { select: { title: true, goal: true, durationMin: true } },
        },
        orderBy: { startedAt: "asc" },
      }),
      prisma.$queryRaw<ScheduleRow[]>`
        SELECT s."id", s."playerId", s."homeTrainingPlanId", s."scheduledFor", s."note", s."completed",
               p."title" AS "planTitle", p."goal" AS "planGoal", p."durationMin"
        FROM "HomeTrainingSchedule" s
        LEFT JOIN "HomeTrainingPlan" p ON p."id" = s."homeTrainingPlanId"
        WHERE s."playerId" = ${playerId}
          AND s."scheduledFor" >= ${range.rangeStart}
          AND s."scheduledFor" < ${range.rangeEnd}
        ORDER BY s."scheduledFor" ASC
      `,
      prisma.homeTrainingPlan.findMany({
        where: { playerId },
        select: { id: true, title: true, goal: true, durationMin: true },
        orderBy: [{ updatedAt: "desc" }],
      }),
    ]);

    const events = [
      ...clubDays.map((item) => ({
        id: `club-${item.id}`,
        sourceId: item.id,
        type: "CLUB" as const,
        date: item.trainingDate.toISOString(),
        title: item.trainingPlan.title,
        goal: item.trainingPlan.goal,
        durationMin: item.trainingPlan.durationMin,
        status: item.status,
        editable: false,
      })),
      ...homeSessions.map((item) => ({
        id: `home-${item.id}`,
        sourceId: item.id,
        type: "HOME" as const,
        date: item.startedAt.toISOString(),
        title: item.plan.title,
        goal: item.plan.goal,
        durationMin: item.plan.durationMin,
        status: item.status,
        editable: false,
      })),
      ...schedules.map((item) => ({
        id: `schedule-${item.id}`,
        sourceId: item.id,
        type: "PLANNED" as const,
        date: item.scheduledFor.toISOString(),
        title: item.planTitle ?? "Geplantes Heimtraining",
        goal: item.planGoal ?? "Freies Training",
        durationMin: item.durationMin,
        status: item.completed ? "COMPLETED" : "PLANNED",
        note: item.note,
        planId: item.homeTrainingPlanId,
        editable: true,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const heatmap = new Map<string, number>();
    for (const event of events) {
      if (event.type === "PLANNED" && event.status !== "COMPLETED") continue;
      const key = dateKey(new Date(event.date));
      heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
    }

    const monthEvents = events.filter((event) => {
      const date = new Date(event.date);
      return date >= range.start && date < range.end;
    });

    return NextResponse.json({
      month: range.start.toISOString().slice(0, 7),
      events,
      plans,
      summary: {
        completed: monthEvents.filter((event) => event.status === "COMPLETED").length,
        planned: monthEvents.filter((event) => event.type === "PLANNED" && event.status === "PLANNED").length,
        club: monthEvents.filter((event) => event.type === "CLUB").length,
        home: monthEvents.filter((event) => event.type === "HOME").length,
      },
      heatmap: [...heatmap.entries()].map(([date, count]) => ({ date, count })),
    });
  } catch (error) {
    console.error("Home calendar GET failed", error);
    return NextResponse.json({ error: "Trainingskalender konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = Number(body.playerId);
    const planId = body.planId === null || body.planId === "" ? null : Number(body.planId);
    const scheduledFor = new Date(String(body.scheduledFor ?? ""));
    const note = String(body.note ?? "").trim() || null;

    if (!Number.isInteger(playerId) || Number.isNaN(scheduledFor.getTime()) || (planId !== null && !Number.isInteger(planId))) {
      return NextResponse.json({ error: "Spieler, Datum oder Plan ist ungültig." }, { status: 400 });
    }

    if (planId !== null) {
      const plan = await prisma.homeTrainingPlan.findFirst({ where: { id: planId, playerId }, select: { id: true } });
      if (!plan) return NextResponse.json({ error: "Trainingsplan wurde nicht gefunden." }, { status: 404 });
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "HomeTrainingSchedule" ("playerId", "homeTrainingPlanId", "scheduledFor", "note", "updatedAt")
      VALUES (${playerId}, ${planId}, ${scheduledFor}, ${note}, CURRENT_TIMESTAMP)
      RETURNING "id"
    `;
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Home calendar POST failed", error);
    return NextResponse.json({ error: "Training konnte nicht geplant werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const playerId = Number(body.playerId);
    const completed = Boolean(body.completed);
    if (!Number.isInteger(id) || !Number.isInteger(playerId)) return NextResponse.json({ error: "Termin fehlt." }, { status: 400 });

    const changed = await prisma.$executeRaw`
      UPDATE "HomeTrainingSchedule"
      SET "completed" = ${completed}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id} AND "playerId" = ${playerId}
    `;
    if (!changed) return NextResponse.json({ error: "Termin wurde nicht gefunden." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Home calendar PATCH failed", error);
    return NextResponse.json({ error: "Termin konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const playerId = Number(body.playerId);
    if (!Number.isInteger(id) || !Number.isInteger(playerId)) return NextResponse.json({ error: "Termin fehlt." }, { status: 400 });

    const changed = await prisma.$executeRaw`
      DELETE FROM "HomeTrainingSchedule" WHERE "id" = ${id} AND "playerId" = ${playerId}
    `;
    if (!changed) return NextResponse.json({ error: "Termin wurde nicht gefunden." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Home calendar DELETE failed", error);
    return NextResponse.json({ error: "Termin konnte nicht gelöscht werden." }, { status: 500 });
  }
}
