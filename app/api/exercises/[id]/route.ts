import { ExerciseResultType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const body = await request.json();
    const categoryNames = parseCategories(body.categories);

    const exercise = await prisma.$transaction(async (tx) => {
      const updated = await tx.exercise.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: String(body.name).trim() }),
          ...(body.description !== undefined && { description: String(body.description).trim() }),
          ...(body.instructions !== undefined && { instructions: String(body.instructions).trim() || null }),
          ...(body.defaultMinutes !== undefined && { defaultMinutes: Number(body.defaultMinutes) }),
          ...(body.minPlayers !== undefined && { minPlayers: Number(body.minPlayers) }),
          ...(body.maxPlayers !== undefined && { maxPlayers: body.maxPlayers === "" ? null : Number(body.maxPlayers) }),
          ...(body.difficulty !== undefined && { difficulty: Number(body.difficulty) }),
          ...(body.resultType !== undefined && { resultType: String(body.resultType) as ExerciseResultType }),
          ...(body.active !== undefined && { active: Boolean(body.active) })
        }
      });

      if (body.categories !== undefined) {
        await tx.exerciseCategoryLink.deleteMany({ where: { exerciseId: id } });
        for (const categoryName of categoryNames) {
          const category = await tx.exerciseCategory.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName }
          });
          await tx.exerciseCategoryLink.create({
            data: { exerciseId: id, categoryId: category.id }
          });
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
