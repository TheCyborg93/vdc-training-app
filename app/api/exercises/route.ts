import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export async function GET() {
  try {
    const [exercises, categories] = await Promise.all([
      prisma.exercise.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { categories: { include: { category: true } } }
      }),
      prisma.exerciseCategory.findMany({ orderBy: { name: "asc" } })
    ]);

    return NextResponse.json({ exercises, categories });
  } catch (error) {
    console.error("Exercise GET failed", error);
    return NextResponse.json({ error: "Übungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const instructions = String(body.instructions ?? "").trim() || null;
    const defaultMinutes = Number(body.defaultMinutes);
    const minPlayers = Number(body.minPlayers ?? 1);
    const maxPlayers = body.maxPlayers === "" || body.maxPlayers == null ? null : Number(body.maxPlayers);
    const difficulty = Number(body.difficulty ?? 1);
    const resultType = String(body.resultType ?? "CUSTOM");
    const categoryNames = parseCategories(body.categories);

    if (!name || !description || !Number.isInteger(defaultMinutes) || defaultMinutes < 1) {
      return NextResponse.json({ error: "Name, Beschreibung und gültige Dauer sind erforderlich." }, { status: 400 });
    }

    const exercise = await prisma.$transaction(async (tx) => {
      const created = await tx.exercise.create({
        data: {
          name,
          description,
          instructions,
          defaultMinutes,
          minPlayers: Math.max(1, minPlayers),
          maxPlayers,
          difficulty: Math.min(5, Math.max(1, difficulty)),
          resultType: resultType as never,
          active: true
        }
      });

      for (const categoryName of categoryNames) {
        const category = await tx.exerciseCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName }
        });
        await tx.exerciseCategoryLink.create({ data: { exerciseId: created.id, categoryId: category.id } });
      }

      return created;
    });

    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error("Exercise POST failed", error);
    return NextResponse.json({ error: "Übung konnte nicht gespeichert werden." }, { status: 500 });
  }
}
