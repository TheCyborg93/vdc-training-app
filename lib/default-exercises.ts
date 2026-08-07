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

const catalogNote = (catalogNumber: number) => `Katalogübung #${String(catalogNumber).padStart(3, "0")}`;

function isCatch40(item: (typeof exerciseCatalog100)[number]) {
  return /^catch\s*40\b/i.test(item.name.trim());
}

function exerciseData(item: (typeof exerciseCatalog100)[number]) {
  const catch40 = isCatch40(item);
  const resultConfig = {
    ...(item.resultConfigJson ?? {}),
    ...(catch40 ? { engineType: "CATCH_40" } : {}),
  };

  return {
    name: item.name,
    shortDescription: item.shortDescription,
    description: item.description,
    instructions: item.instructions,
    materials: "Dartboard und drei Darts",
    trainerNotes: catalogNote(item.catalogNumber),
    defaultMinutes: item.defaultMinutes,
    minPlayers: item.minPlayers,
    maxPlayers: item.maxPlayers ?? null,
    difficulty: item.difficulty,
    intensity: item.intensity,
    funFactor: item.funFactor,
    learningCurve: item.learningCurve,
    resultType: catch40 ? "SCORE_0_TO_180" as const : item.resultType,
    engine: catch40 ? "CATCH_40" as const : item.engine,
    completionMode: item.completionMode,
    completionValue: item.completionValue ?? null,
    resultConfigJson: resultConfig as Prisma.InputJsonValue,
    tagsJson: item.tags as Prisma.InputJsonValue,
    variantsJson: [] as Prisma.InputJsonValue,
    favorite: item.favorite ?? false,
    active: true,
  };
}

async function inBatches<T>(items: T[], size: number, worker: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

/**
 * Synchronisiert den vollständigen 100er-Katalog idempotent.
 * Bewusst ohne eine einzige große Transaktion: Supabase/Pooler kann hunderte
 * serielle Schreibvorgänge sonst vollständig zurückrollen.
 */
export async function syncExerciseCatalog(prisma: PrismaClient): Promise<ExerciseCatalogSyncResult> {
  const result: ExerciseCatalogSyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    deactivated: 0,
    total: exerciseCatalog100.length,
  };

  const catalogNames = new Set(exerciseCatalog100.map((item) => item.name.toLocaleLowerCase("de-DE")));
  const existingExercises = await prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { planItems: true, results: true, homeResults: true } },
    },
  });

  const oldExercises = existingExercises.filter((item) => !catalogNames.has(item.name.toLocaleLowerCase("de-DE")));
  await inBatches(oldExercises, 20, async (existing) => {
    const referenced = existing._count.planItems + existing._count.results + existing._count.homeResults > 0;
    if (referenced) {
      await prisma.exercise.update({ where: { id: existing.id }, data: { active: false, favorite: false } });
      result.deactivated += 1;
    } else {
      await prisma.exercise.delete({ where: { id: existing.id } });
      result.deleted += 1;
    }
  });

  const categoryNames = [...new Set(exerciseCatalog100.flatMap((item) => item.categories))];
  await prisma.exerciseCategory.createMany({
    data: categoryNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const categories = await prisma.exerciseCategory.findMany({
    where: { name: { in: categoryNames } },
    select: { id: true, name: true },
  });
  const categoryIds = new Map(categories.map((category) => [category.name, category.id]));

  const remainingExercises = await prisma.exercise.findMany({
    where: { name: { in: exerciseCatalog100.map((item) => item.name) } },
    select: { id: true, name: true },
  });
  const existingByName = new Map(remainingExercises.map((item) => [item.name.toLocaleLowerCase("de-DE"), item]));

  const missing = exerciseCatalog100.filter((item) => !existingByName.has(item.name.toLocaleLowerCase("de-DE")));
  if (missing.length) {
    const created = await prisma.exercise.createMany({ data: missing.map(exerciseData) });
    result.created = created.count;
  }

  const existingCatalogItems = exerciseCatalog100.filter((item) => existingByName.has(item.name.toLocaleLowerCase("de-DE")));
  await inBatches(existingCatalogItems, 20, async (item) => {
    const existing = existingByName.get(item.name.toLocaleLowerCase("de-DE"));
    if (!existing) return;
    await prisma.exercise.update({ where: { id: existing.id }, data: exerciseData(item) });
    result.updated += 1;
  });

  const catalogExercises = await prisma.exercise.findMany({
    where: { name: { in: exerciseCatalog100.map((item) => item.name) } },
    select: { id: true, name: true },
  });
  const exerciseIds = new Map(catalogExercises.map((exercise) => [exercise.name.toLocaleLowerCase("de-DE"), exercise.id]));
  const allCatalogIds = catalogExercises.map((exercise) => exercise.id);

  if (allCatalogIds.length) {
    await prisma.exerciseCategoryLink.deleteMany({ where: { exerciseId: { in: allCatalogIds } } });
    const links = exerciseCatalog100.flatMap((item) => {
      const exerciseId = exerciseIds.get(item.name.toLocaleLowerCase("de-DE"));
      if (!exerciseId) return [];
      return item.categories.flatMap((categoryName) => {
        const categoryId = categoryIds.get(categoryName);
        return categoryId ? [{ exerciseId, categoryId }] : [];
      });
    });
    if (links.length) await prisma.exerciseCategoryLink.createMany({ data: links, skipDuplicates: true });
  }

  await prisma.exerciseCategory.deleteMany({ where: { exercises: { none: {} } } });
  return result;
}

export async function ensureDefaultExercises(prisma: PrismaClient): Promise<number> {
  const result = await syncExerciseCatalog(prisma);
  return result.created;
}
