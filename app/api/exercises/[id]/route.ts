import { ExerciseResultType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const body = await request.json();
    const categoryNames = parseStringArray(body.categories);

    const exercise = await prisma.$transaction(async (tx) => {
      const updated = await tx.exercise.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: String(body.name).trim() }),
          ...(body.shortDescription !== undefined && { shortDescription: String(body.shortDescription).trim() || null }),
          ...(body.description !== undefined && { description: String(body.description).trim() }),
          ...(body.instructions !== undefined && { instructions: String(body.instructions).trim() || null }),
          ...(body.materials !== undefined && { materials: String(body.materials).trim() || null }),
          ...(body.trainerNotes !== undefined && { trainerNotes: String(body.trainerNotes).trim() || null }),
          ...(body.defaultMinutes !== undefined && { defaultMinutes: Math.max(1, Number(body.defaultMinutes)) }),
          ...(body.minPlayers !== undefined && { minPlayers: Math.max(1, Number(body.minPlayers)) }),
          ...(body.maxPlayers !== undefined && { maxPlayers: body.maxPlayers === "" ? null : Math.max(1, Number(body.maxPlayers)) }),
          ...(body.difficulty !== undefined && { difficulty: clamp(body.difficulty, 1, 10, 5) }),
          ...(body.intensity !== undefined && { intensity: clamp(body.intensity, 1, 10, 5) }),
          ...(body.funFactor !== undefined && { funFactor: clamp(body.funFactor, 1, 10, 5) }),
          ...(body.learningCurve !== undefined && { learningCurve: clamp(body.learningCurve, 1, 10, 5) }),
          ...(body.resultType !== undefined && { resultType: String(body.resultType) as ExerciseResultType }),
          ...(body.tags !== undefined && { tagsJson: parseStringArray(body.tags) }),
          ...(body.variants !== undefined && { variantsJson: parseStringArray(body.variants) }),
          ...(body.favorite !== undefined && { favorite: Boolean(body.favorite) }),
          ...(body.active !== undefined && { active: Boolean(body.active) })
        }
      });

      if (body.categories !== undefined) {
        await tx.exerciseCategoryLink.deleteMany({ where: { exerciseId: id } });
        for (const categoryName of categoryNames) {
          const category = await tx.exerciseCategory.upsert({
            where: { name: categoryName }, update: {}, create: { name: categoryName }
          });
          await tx.exerciseCategoryLink.create({ data: { exerciseId: id, categoryId: category.id } });
        }
      }

      return updated;
    });

    return NextResponse.json(exercise);
  } catch (error) {
    console.error("Exercise PATCH failed", error);
    return NextResponse.json({ error: "Übung konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
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
