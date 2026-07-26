import { ExerciseCompletionMode, ExerciseEngine, ExerciseResultType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncExerciseCatalog } from "@/lib/default-exercises";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function completionValue(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function ensureCatalog100() {
  const [activeCount, finalCatalogExercise] = await Promise.all([
    prisma.exercise.count({ where: { active: true, trainerNotes: { startsWith: "Katalogübung #" } } }),
    prisma.exercise.findFirst({ where: { trainerNotes: "Katalogübung #100", active: true }, select: { id: true } }),
  ]);
  if (activeCount !== 100 || !finalCatalogExercise) return syncExerciseCatalog(prisma);
  return null;
}

export async function GET() {
  try {
    const catalogSync = await ensureCatalog100();
    const [exercises, categories] = await Promise.all([
      prisma.exercise.findMany({
        orderBy: [{ active: "desc" }, { trainerNotes: "asc" }, { name: "asc" }],
        include: { categories: { include: { category: true } } },
      }),
      prisma.exerciseCategory.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ exercises, categories, catalogSync });
  } catch (error) {
    console.error("Exercise GET failed", error);
    return NextResponse.json({ error: "Übungen konnten nicht geladen werden. Bitte Datenbankverbindung und Prisma-Schema prüfen." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "sync-defaults" || body.action === "replace-catalog") {
      const result = await syncExerciseCatalog(prisma);
      return NextResponse.json({
        ...result,
        message: `100er-Katalog synchronisiert: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.deleted} Altübungen gelöscht und ${result.deactivated} historische Altübungen deaktiviert.`,
      });
    }

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const defaultMinutes = Number(body.defaultMinutes);
    const categoryNames = parseStringArray(body.categories);
    const mode = String(body.completionMode ?? "ENGINE_DEFAULT") as ExerciseCompletionMode;
    const limit = completionValue(body.completionValue);

    if (!name || !description || !Number.isInteger(defaultMinutes) || defaultMinutes < 1) {
      return NextResponse.json({ error: "Name, Beschreibung und gültige Dauer sind erforderlich." }, { status: 400 });
    }
    if (["VISIT_LIMIT", "DART_LIMIT", "TIME_LIMIT"].includes(mode) && limit == null) {
      return NextResponse.json({ error: "Für diese Abschlussbedingung ist ein Wert größer als 0 erforderlich." }, { status: 400 });
    }

    const duplicate = await prisma.exercise.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (duplicate) return NextResponse.json({ error: "Eine Übung mit diesem Namen existiert bereits." }, { status: 409 });

    const exercise = await prisma.$transaction(async (tx) => {
      const created = await tx.exercise.create({
        data: {
          name,
          shortDescription: String(body.shortDescription ?? "").trim() || null,
          description,
          instructions: String(body.instructions ?? "").trim() || null,
          materials: String(body.materials ?? "").trim() || null,
          trainerNotes: String(body.trainerNotes ?? "").trim() || null,
          defaultMinutes,
          minPlayers: Math.max(1, Number(body.minPlayers ?? 1)),
          maxPlayers: body.maxPlayers === "" || body.maxPlayers == null ? null : Math.max(1, Number(body.maxPlayers)),
          difficulty: clamp(body.difficulty, 1, 10, 5),
          intensity: clamp(body.intensity, 1, 10, 5),
          funFactor: clamp(body.funFactor, 1, 10, 5),
          learningCurve: clamp(body.learningCurve, 1, 10, 5),
          resultType: String(body.resultType ?? "CUSTOM") as ExerciseResultType,
          engine: String(body.engine ?? "AUTO") as ExerciseEngine,
          completionMode: mode,
          completionValue: limit,
          resultConfigJson: body.resultConfigJson ?? undefined,
          tagsJson: parseStringArray(body.tags),
          variantsJson: parseStringArray(body.variants),
          favorite: Boolean(body.favorite),
          active: true,
        },
      });

      for (const categoryName of categoryNames) {
        const category = await tx.exerciseCategory.upsert({ where: { name: categoryName }, update: {}, create: { name: categoryName } });
        await tx.exerciseCategoryLink.create({ data: { exerciseId: created.id, categoryId: category.id } });
      }
      return created;
    });

    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error("Exercise POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Übung konnte nicht gespeichert werden." }, { status: 500 });
  }
}
