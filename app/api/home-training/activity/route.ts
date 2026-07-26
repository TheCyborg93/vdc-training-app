import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORE_FOCUS = ["Scoring", "Doppel", "Checkout", "Mental", "Konstanz"];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function dayKey(value: Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function weekKey(value: Date) {
  return dayKey(startOfWeek(value));
}

function resolveFocus(categories: string[], fallback: string) {
  const normalized = [...categories, fallback].map((item) => item.toLowerCase());
  return CORE_FOCUS.find((focus) => normalized.some((item) => item.includes(focus.toLowerCase()))) ?? (fallback || "Sonstiges");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    }

    const since = addDays(startOfDay(new Date()), -55);
    const [clubResults, homeResults, completedSessions] = await Promise.all([
      prisma.exerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since } },
        select: {
          createdAt: true,
          exercise: {
            select: {
              name: true,
              categories: { select: { category: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 240,
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since } },
        select: {
          createdAt: true,
          exercise: {
            select: {
              name: true,
              categories: { select: { category: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 240,
      }),
      prisma.homeTrainingSession.findMany({
        where: { playerId, status: "COMPLETED", completedAt: { gte: since } },
        select: { completedAt: true },
        orderBy: { completedAt: "desc" },
        take: 80,
      }),
    ]);

    const activityDays = new Set<string>();
    const focusCounts = new Map<string, number>(CORE_FOCUS.map((focus) => [focus, 0]));

    for (const result of [...clubResults, ...homeResults]) {
      activityDays.add(dayKey(result.createdAt));
      const categories = result.exercise.categories.map((item) => item.category.name);
      const focus = resolveFocus(categories, result.exercise.name);
      if (CORE_FOCUS.includes(focus)) focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    }
    for (const session of completedSessions) {
      if (session.completedAt) activityDays.add(dayKey(session.completedAt));
    }

    const now = new Date();
    const currentWeek = startOfWeek(now);
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const start = addDays(currentWeek, (index - 3) * 7);
      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(start, dayIndex);
        return { date: dayKey(date), active: activityDays.has(dayKey(date)) };
      });
      return {
        key: weekKey(start),
        label: index === 3 ? "Diese Woche" : `ab ${start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
        activeDays: days.filter((day) => day.active).length,
        days,
      };
    });

    const currentWeekDays = weeks[3]?.activeDays ?? 0;
    let streak = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      const start = addDays(currentWeek, -offset * 7);
      const active = Array.from(activityDays).some((key) => weekKey(new Date(`${key}T12:00:00`)) === weekKey(start));
      if (!active && offset === 0 && currentWeekDays === 0) continue;
      if (!active) break;
      streak += 1;
    }

    const focus = CORE_FOCUS.reduce((lowest, item) => {
      const count = focusCounts.get(item) ?? 0;
      return count < (focusCounts.get(lowest) ?? 0) ? item : lowest;
    }, CORE_FOCUS[0]);

    return NextResponse.json({
      currentWeekDays,
      weeklyTarget: 2,
      streak,
      weeks,
      focus,
      focusCounts: CORE_FOCUS.map((name) => ({ name, count: focusCounts.get(name) ?? 0 })),
      recommendation: currentWeekDays >= 2
        ? `Wochenziel erreicht. Eine kurze ${focus}-Einheit hält deinen Rhythmus stabil.`
        : `Dir fehlt noch ${2 - currentWeekDays} Einheit${2 - currentWeekDays === 1 ? "" : "en"}. Starte am besten mit ${focus}.`,
      completedHomeSessions: completedSessions.length,
    });
  } catch (error) {
    console.error("Home activity GET failed", error);
    return NextResponse.json({ error: "Aktivitätsdaten konnten nicht geladen werden." }, { status: 500 });
  }
}
