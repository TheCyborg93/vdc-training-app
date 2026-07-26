import { ExerciseCompletionMode, ExerciseEngine, ExerciseResultType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncExerciseCatalog } from "@/lib/default-exercises";

export const preferredRegion = "lhr1";
export const runtime = "nodejs";

let catalogCheckedForInstance = false;

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

async function bootstrapCatalogWhenEmpty() {
  if (catalogCheckedForInstance) return null;

  const catalogExercise = await prisma.exercise.findFirst({
    where: { trainerNotes: { startsWith: "Katalogübung #" }, active: true },
    select: { id: true },
  });

  if (catalogExercise) {
    catalogCheckedForInstance = true;
    return null;
  }

  const result = await syncExerciseCatalog(prisma);
  catalogCheckedForInstance = true;
  return result;
}

export async function GET() {
  try {
    const catalogSync = await bootstrapCatalogWhenEmpty();
    const [exercises, categories] = await Promise.all([
      prisma.exercise.findMany({
        orderBy: [{ active: "desc" }, { trainerNotes: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          shortDescription: true,
          description: true,
          instructions: true,
          materials: true,
          trainerNotes: true,
          defaultMinutes: true,
          minPlayers: true,
          maxPlayers: true,
          difficulty: true,
          intensity: true,
          funFactor: true,
          learningCurve: true,
          resultType: true,
          engine: true,
          completionMode: true,
          completionValue: true,
          tagsJson: true,
          variantsJson: true,
          favorite: true,
          active: true,
          categories: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.exerciseCategory.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json(
      { exercises, categories, catalogSync },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=120",
          "Server-Timing": catalogSync ? "catalog-sync;desc=100er-Katalog synchronisiert" : "catalog-read;desc=Katalog geladen",
        },
      },
    );
  } catch (error) {
    console.error("Exercise GET failed", error);
    catalogCheckedForInstance = false;
    return NextResponse.json(
      { error: "Übungen konnten nicht geladen werden. Bitte Datenbankverbindung und Prisma-Schema prüfen." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "sync-defaults" || body.action === "replace-catalog") {
      const result = await syncExerciseCatalog(prisma);
      catalogCheckedForInstance = true;
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

    const duplicate = await prisma.exercise.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
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
          resultConfigJson:
            body.resultConfigJson && typeof body.resultConfigJson === "object"
              ? (body.resultConfigJson as Prisma.InputJsonValue)
              : undefined,
          tagsJson: parseStringArray(body.tags),
          variantsJson: parseStringArray(body.variants),
          favorite: Boolean(body.favorite),
          active: true,
        },
      });

      for (const categoryName of categoryNames) {
        const category = await tx.exerciseCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });
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
