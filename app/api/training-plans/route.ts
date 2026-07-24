import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const plans = await prisma.trainingPlan.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        exercises: {
          orderBy: { position: "asc" },
          include: { exercise: true },
        },
      },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error("Training plan GET failed", error);
    return NextResponse.json({ error: "Trainingspläne konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const goal = String(body.goal ?? "").trim();
    const durationMin = Number(body.durationMin);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!title || !goal || !Number.isInteger(durationMin) || durationMin < 10 || items.length === 0) {
      return NextResponse.json({ error: "Titel, Trainingsziel, Dauer und mindestens eine Übung sind erforderlich." }, { status: 400 });
    }

    const normalizedItems = items.map((item: { exerciseId?: unknown; durationMin?: unknown }, index: number) => ({
      exerciseId: Number(item.exerciseId),
      durationMin: Number(item.durationMin),
      position: index + 1,
    }));

    if (normalizedItems.some((item: { exerciseId: number; durationMin: number }) => !Number.isInteger(item.exerciseId) || !Number.isInteger(item.durationMin) || item.durationMin < 1)) {
      return NextResponse.json({ error: "Eine Übung enthält ungültige Werte." }, { status: 400 });
    }

    const creator = await prisma.user.upsert({
      where: { email: "trainer@vdc-training.de" },
      update: { name: "VDC Trainer", active: true },
      create: {
        name: "VDC Trainer",
        email: "trainer@vdc-training.de",
        passwordHash: "SUPABASE_AUTH",
        role: "TRAINER",
        active: true,
      },
    });

    const plan = await prisma.trainingPlan.create({
      data: {
        title,
        goal,
        durationMin,
        status: "DRAFT",
        createdById: creator.id,
        exercises: { create: normalizedItems },
      },
      include: {
        exercises: {
          orderBy: { position: "asc" },
          include: { exercise: true },
        },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Training plan POST failed", error);
    return NextResponse.json({ error: "Trainingsplan konnte nicht gespeichert werden." }, { status: 500 });
  }
}
