import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function idFrom(params: Promise<{ id: string }>) {
  return params.then((value) => Number(value.id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFrom(context.params);
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.instructions !== undefined) data.instructions = String(body.instructions).trim() || null;
    if (body.defaultMinutes !== undefined) data.defaultMinutes = Number(body.defaultMinutes);
    if (body.minPlayers !== undefined) data.minPlayers = Number(body.minPlayers);
    if (body.maxPlayers !== undefined) data.maxPlayers = body.maxPlayers === "" ? null : Number(body.maxPlayers);
    if (body.difficulty !== undefined) data.difficulty = Number(body.difficulty);
    if (body.resultType !== undefined) data.resultType = String(body.resultType);
    if (body.active !== undefined) data.active = Boolean(body.active);

    const exercise = await prisma.exercise.update({ where: { id }, data });
    return NextResponse.json(exercise);
  } catch (error) {
    console.error("Exercise PATCH failed", error);
    return NextResponse.json({ error: "Übung konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFrom(context.params);
    const used = await prisma.trainingPlanExercise.count({ where: { exerciseId: id } });
    if (used > 0) {
      await prisma.exercise.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ deactivated: true });
    }
    await prisma.exercise.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Exercise DELETE failed", error);
    return NextResponse.json({ error: "Übung konnte nicht entfernt werden." }, { status: 500 });
  }
}
