import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const preferredRegion = "lhr1";
export const runtime = "nodejs";

type RequestBody = {
  title?: unknown;
  focus?: unknown;
  exercises?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const title = String(body.title ?? "").trim();
    const focus = String(body.focus ?? "").trim();
    const exerciseNames = Array.isArray(body.exercises)
      ? body.exercises.map(String).map((name) => name.trim()).filter(Boolean)
      : [];

    if (!title || !focus || exerciseNames.length === 0) {
      return NextResponse.json(
        { error: "Titel, Schwerpunkt und mindestens eine Übung sind erforderlich." },
        { status: 400 },
      );
    }

    const exercises = await prisma.exercise.findMany({
      where: { active: true, name: { in: exerciseNames } },
      select: { id: true, name: true },
    });
    const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
    const ordered = exerciseNames.map((name) => byName.get(name)).filter((exercise): exercise is { id: number; name: string } => Boolean(exercise));

    if (ordered.length === 0) {
      return NextResponse.json(
        { error: "Keine der empfohlenen Übungen wurde im aktiven Übungskatalog gefunden." },
        { status: 404 },
      );
    }

    const durationMin = 90;
    const baseDuration = Math.floor(durationMin / ordered.length);
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
      select: { id: true },
    });

    const plan = await prisma.trainingPlan.create({
      data: {
        title,
        goal: focus,
        durationMin,
        status: "DRAFT",
        createdById: creator.id,
        exercises: {
          create: ordered.map((exercise, index) => ({
            exerciseId: exercise.id,
            position: index + 1,
            durationMin: index === ordered.length - 1
              ? durationMin - baseDuration * (ordered.length - 1)
              : baseDuration,
          })),
        },
      },
      select: { id: true, title: true, goal: true, durationMin: true, status: true },
    });

    return NextResponse.json({
      plan,
      missingExercises: exerciseNames.filter((name) => !byName.has(name)),
    }, { status: 201 });
  } catch (error) {
    console.error("AI Coach plan creation failed", error);
    return NextResponse.json(
      { error: "Der empfohlene Trainingsplan konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
