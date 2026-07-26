import type { Prisma, PrismaClient } from "@prisma/client";
import { exerciseCatalog100 } from "@/lib/exercise-catalog-100";

export const defaultExercises = exerciseCatalog100;

export type ExerciseCatalogSyncResult = {
  created: number;
  updated: number;
  deleted: number;
  deactivated: number;
  total: number;
};

export async function syncExerciseCatalog(prisma: PrismaClient): Promise<ExerciseCatalogSyncResult> {
  const result: ExerciseCatalogSyncResult = { created: 0, updated: 0, deleted: 0, deactivated: 0, total: exerciseCatalog100.length };
  const catalogNames = new Set(exerciseCatalog100.map((item) => item.name.toLocaleLowerCase("de-DE")));

  await prisma.$transaction(async (tx) => {
    const existingExercises = await tx.exercise.findMany({
      include: {
        _count: { select: { planItems: true, results: true, homeResults: true } },
      },
    });

    for (const existing of existingExercises) {
      if (catalogNames.has(existing.name.toLocaleLowerCase("de-DE"))) continue;
      const referenced = existing._count.planItems + existing._count.results + existing._count.homeResults > 0;
      if (referenced) {
        await tx.exercise.update({ where: { id: existing.id }, data: { active: false, favorite: false } });
        result.deactivated += 1;
      } else {
        await tx.exercise.delete({ where: { id: existing.id } });
        result.deleted += 1;
      }
    }

    for (const item of exerciseCatalog100) {
      const current = await tx.exercise.findFirst({ where: { name: { equals: item.name, mode: "insensitive" } } });
      const data = {
        name: item.name,
        shortDescription: item.shortDescription,
        description: item.description,
        instructions: item.instructions,
        materials: "Dartboard und drei Darts",
        trainerNotes: `Katalogübung #${String(item.catalogNumber).padStart(3, "0")}`,
        defaultMinutes: item.defaultMinutes,
        minPlayers: item.minPlayers,
        maxPlayers: item.maxPlayers ?? null,
        difficulty: item.difficulty,
        intensity: item.intensity,
        funFactor: item.funFactor,
        learningCurve: item.learningCurve,
        resultType: item.resultType,
        engine: item.engine,
        completionMode: item.completionMode,
        completionValue: item.completionValue ?? null,
        resultConfigJson: item.resultConfigJson as Prisma.InputJsonValue,
        tagsJson: item.tags as Prisma.InputJsonValue,
        variantsJson: [] as Prisma.InputJsonValue,
        favorite: item.favorite ?? false,
        active: true,
      };

      const exercise = current
        ? await tx.exercise.update({ where: { id: current.id }, data })
        : await tx.exercise.create({ data });
      if (current) result.updated += 1;
      else result.created += 1;

      await tx.exerciseCategoryLink.deleteMany({ where: { exerciseId: exercise.id } });
      for (const categoryName of item.categories) {
        const category = await tx.exerciseCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });
        await tx.exerciseCategoryLink.create({ data: { exerciseId: exercise.id, categoryId: category.id } });
      }
    }

    const unusedCategories = await tx.exerciseCategory.findMany({
      where: { exercises: { none: {} } },
      select: { id: true },
    });
    if (unusedCategories.length) {
      await tx.exerciseCategory.deleteMany({ where: { id: { in: unusedCategories.map((item) => item.id) } } });
    }
  }, { timeout: 60_000 });

  return result;
}

export async function ensureDefaultExercises(prisma: PrismaClient): Promise<number> {
  const result = await syncExerciseCatalog(prisma);
  return result.created;
}
