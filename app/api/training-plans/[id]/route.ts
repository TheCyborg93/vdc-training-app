import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const entry = item as { exerciseId?: unknown; durationMin?: unknown };
    return {
      exerciseId: Number(entry.exerciseId),
      durationMin: Number(entry.durationMin),
      position: index + 1,
    };
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const planId = Number(id);
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const goal = String(body.goal ?? "").trim();
    const durationMin = Number(body.durationMin);
    const items = normalizeItems(body.items);

    if (!Number.isInteger(planId) || !title || !goal || !Number.isInteger(durationMin) || durationMin < 10 || items.length === 0) {
      return NextResponse.json({ error: "Titel, Ziel, Dauer und mindestens eine Übung sind erforderlich." }, { status: 400 });
    }
    if (items.some((item) => !Number.isInteger(item.exerciseId) || !Number.isInteger(item.durationMin) || item.durationMin < 1)) {
      return NextResponse.json({ error: "Eine Übung enthält ungültige Werte." }, { status: 400 });
    }

    const existing = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: "Trainingsplan wurde nicht gefunden." }, { status: 404 });
    if (existing.status !== "DRAFT") return NextResponse.json({ error: "Nur unveröffentlichte Entwürfe können bearbeitet werden." }, { status: 409 });

    const plan = await prisma.$transaction(async (tx) => {
      await tx.trainingPlanExercise.deleteMany({ where: { trainingPlanId: planId } });
      return tx.trainingPlan.update({
        where: { id: planId },
        data: { title, goal, durationMin, exercises: { create: items } },
        include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } },
      });
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Training plan PUT failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trainingsplan konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const planId = Number(id);
    if (!Number.isInteger(planId)) return NextResponse.json({ error: "Ungültiger Trainingsplan." }, { status: 400 });

    const existing = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: "Trainingsplan wurde nicht gefunden." }, { status: 404 });
    if (existing.status !== "DRAFT") return NextResponse.json({ error: "Nur unveröffentlichte Entwürfe können gelöscht werden." }, { status: 409 });

    await prisma.trainingPlan.delete({ where: { id: planId } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Training plan DELETE failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trainingsplan konnte nicht gelöscht werden." }, { status: 500 });
  }
}
