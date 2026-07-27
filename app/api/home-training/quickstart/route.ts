import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORE_FOCUS = ["Scoring", "Doppel", "Checkout", "Mental", "Konstanz"];

type PlanItem = { exerciseId?: unknown; durationMin?: unknown };

function itemCount(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => Number.isInteger(Number((item as PlanItem).exerciseId))).length;
}

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
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function resolveFocus(categories: string[], fallback: string) {
  const values = [...categories, fallback].map((item) => item.toLowerCase());
  return CORE_FOCUS.find((focus) => values.some((item) => item.includes(focus.toLowerCase()))) ?? "Sonstiges";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });

    const now = new Date();
    const since = addDays(startOfDay(now), -27);
    const weekStart = startOfWeek(now);

    const [plans, clubResults, homeResults, activeSession] = await Promise.all([
      prisma.homeTrainingPlan.findMany({
        where: { playerId },
        select: { id: true, title: true, goal: true, durationMin: true, planJson: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.exerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since } },
        select: {
          createdAt: true,
          exercise: { select: { name: true, categories: { select: { category: { select: { name: true } } } } } },
        },
        take: 240,
      }),
      prisma.homeExerciseResult.findMany({
        where: { playerId, deletedAt: null, createdAt: { gte: since } },
        select: {
          createdAt: true,
          exercise: { select: { name: true, categories: { select: { category: { select: { name: true } } } } } },
        },
        take: 240,
      }),
      prisma.homeTrainingSession.findFirst({
        where: { playerId, status: { in: ["RUNNING", "PAUSED"] } },
        select: { id: true, homeTrainingPlanId: true, status: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const counts = new Map<string, number>(CORE_FOCUS.map((focus) => [focus, 0]));
    const weekDays = new Set<string>();
    for (const result of [...clubResults, ...homeResults]) {
      const categories = result.exercise.categories.map((item) => item.category.name);
      const focus = resolveFocus(categories, result.exercise.name);
      if (counts.has(focus)) counts.set(focus, (counts.get(focus) ?? 0) + 1);
      if (result.createdAt >= weekStart) weekDays.add(startOfDay(result.createdAt).toISOString().slice(0, 10));
    }

    const priorityFocus = CORE_FOCUS.reduce((lowest, focus) =>
      (counts.get(focus) ?? 0) < (counts.get(lowest) ?? 0) ? focus : lowest,
    CORE_FOCUS[0]);

    const normalizedPlans = plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      goal: plan.goal,
      durationMin: plan.durationMin,
      exerciseCount: itemCount(plan.planJson),
      priority: plan.goal.toLowerCase().includes(priorityFocus.toLowerCase()),
      updatedAt: plan.updatedAt,
    }));

    const recommendations = normalizedPlans
      .sort((a, b) => Number(b.priority) - Number(a.priority) || Math.abs(a.durationMin - 45) - Math.abs(b.durationMin - 45) || b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map(({ updatedAt: _updatedAt, ...plan }) => plan);

    const daysRemaining = Math.max(0, 2 - weekDays.size);
    const suggestedDays = Array.from({ length: daysRemaining }, (_, index) => {
      const offset = index === 0 ? 0 : 3;
      const date = addDays(now, offset);
      return {
        date: date.toISOString(),
        label: offset === 0 ? "Heute" : date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }),
        focus: index === 0 ? priorityFocus : CORE_FOCUS[(CORE_FOCUS.indexOf(priorityFocus) + 1) % CORE_FOCUS.length],
      };
    });

    return NextResponse.json({
      activeSession,
      priorityFocus,
      weekProgress: weekDays.size,
      weeklyTarget: 2,
      recommendations,
      suggestedDays,
      focusCounts: CORE_FOCUS.map((name) => ({ name, count: counts.get(name) ?? 0 })),
    });
  } catch (error) {
    console.error("Home quickstart GET failed", error);
    return NextResponse.json({ error: "Schnellstart konnte nicht vorbereitet werden." }, { status: 500 });
  }
}
