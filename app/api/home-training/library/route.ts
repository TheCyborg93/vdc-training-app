import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LibraryRow = {
  id: number;
  playerId: number;
  title: string;
  goal: string;
  durationMin: number;
  planJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  favorite: boolean;
  archived: boolean;
  folder: string | null;
  source: string;
  version: number;
  usageCount: number;
  resultCount: number;
  lastUsedAt: Date | null;
  averageScore: number | null;
};

type MetaRow = { favorite: boolean; archived: boolean; folder: string | null };

function exerciseCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function recommendation(goal: string, duration: number, usageCount: number) {
  const normalized = goal.toLowerCase();
  if (normalized.includes("checkout") || normalized.includes("doppel")) return "Ideal für Checkouts und Wettkampfvorbereitung.";
  if (normalized.includes("mental")) return "Gut für fokussierte Einheiten vor Ligaspielen.";
  if (duration <= 30) return "Perfekt als kurze Einheit oder zum Warmwerfen.";
  if (usageCount >= 5) return "Bewährter Plan aus deiner regelmäßigen Routine.";
  return "Ausgewogene Einheit für deinen persönlichen Trainingsrhythmus.";
}

function rating(row: LibraryRow) {
  const usage = Math.min(1.2, row.usageCount * 0.12);
  const results = Math.min(0.8, row.resultCount * 0.015);
  const duration = row.durationMin >= 30 && row.durationMin <= 75 ? 0.6 : 0.3;
  return Math.min(5, Math.round((3 + usage + results + duration) * 10) / 10);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });

    const rows = await prisma.$queryRaw<LibraryRow[]>`
      SELECT
        p."id", p."playerId", p."title", p."goal", p."durationMin", p."planJson", p."createdAt", p."updatedAt",
        COALESCE(m."favorite", false) AS "favorite",
        COALESCE(m."archived", false) AS "archived",
        m."folder",
        COALESCE(m."source", 'OWN') AS "source",
        COALESCE(m."version", 1) AS "version",
        COUNT(DISTINCT s."id")::int AS "usageCount",
        COUNT(r."id")::int AS "resultCount",
        MAX(COALESCE(s."completedAt", s."startedAt")) AS "lastUsedAt",
        AVG(r."calculatedScore") FILTER (WHERE r."calculatedScore" IS NOT NULL) AS "averageScore"
      FROM "HomeTrainingPlan" p
      LEFT JOIN "HomePlanLibraryMeta" m ON m."planId" = p."id"
      LEFT JOIN "HomeTrainingSession" s ON s."homeTrainingPlanId" = p."id"
      LEFT JOIN "HomeExerciseResult" r ON r."homeTrainingSessionId" = s."id" AND r."deletedAt" IS NULL
      WHERE p."playerId" = ${playerId}
      GROUP BY p."id", m."favorite", m."archived", m."folder", m."source", m."version"
      ORDER BY COALESCE(m."favorite", false) DESC, p."updatedAt" DESC
    `;

    const plans = rows.map((row) => ({
      ...row,
      exerciseCount: exerciseCount(row.planJson),
      rating: rating(row),
      recommendation: recommendation(row.goal, row.durationMin, row.usageCount),
      averageScore: row.averageScore === null ? null : Math.round(Number(row.averageScore) * 10) / 10,
    }));

    const active = plans.filter((plan) => !plan.archived);
    const categories = new Map<string, number>();
    for (const plan of active) categories.set(plan.goal, (categories.get(plan.goal) ?? 0) + 1);
    const bestCategory = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–";

    return NextResponse.json({
      plans,
      summary: {
        total: active.length,
        favorites: active.filter((plan) => plan.favorite).length,
        archived: plans.filter((plan) => plan.archived).length,
        trainings: plans.reduce((sum, plan) => sum + plan.usageCount, 0),
        bestCategory,
      },
    });
  } catch (error) {
    console.error("Home library GET failed", error);
    return NextResponse.json({ error: "Planbibliothek konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const planId = Number(body.planId);
    const playerId = Number(body.playerId);
    if (action !== "duplicate" || !Number.isInteger(planId) || !Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
    }

    const source = await prisma.homeTrainingPlan.findFirst({ where: { id: planId, playerId } });
    if (!source) return NextResponse.json({ error: "Plan wurde nicht gefunden." }, { status: 404 });

    const duplicate = await prisma.homeTrainingPlan.create({
      data: {
        playerId,
        title: `${source.title} (Kopie)`,
        goal: source.goal,
        durationMin: source.durationMin,
        planJson: source.planJson === null ? Prisma.JsonNull : source.planJson as Prisma.InputJsonValue,
      },
    });

    await prisma.$executeRaw`
      INSERT INTO "HomePlanLibraryMeta" ("planId", "source", "version", "updatedAt")
      VALUES (${duplicate.id}, 'DUPLICATE', 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("planId") DO NOTHING
    `;

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    console.error("Home library POST failed", error);
    return NextResponse.json({ error: "Plan konnte nicht dupliziert werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const planId = Number(body.planId);
    const playerId = Number(body.playerId);
    if (!Number.isInteger(planId) || !Number.isInteger(playerId)) return NextResponse.json({ error: "Plan fehlt." }, { status: 400 });

    const plan = await prisma.homeTrainingPlan.findFirst({ where: { id: planId, playerId } });
    if (!plan) return NextResponse.json({ error: "Plan wurde nicht gefunden." }, { status: 404 });

    const [current] = await prisma.$queryRaw<MetaRow[]>`
      SELECT "favorite", "archived", "folder" FROM "HomePlanLibraryMeta" WHERE "planId" = ${planId}
    `;
    const favorite = typeof body.favorite === "boolean" ? body.favorite : current?.favorite ?? false;
    const archived = typeof body.archived === "boolean" ? body.archived : current?.archived ?? false;
    const folder = Object.prototype.hasOwnProperty.call(body, "folder")
      ? typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : null
      : current?.folder ?? null;

    const title = typeof body.title === "string" ? body.title.trim() : null;
    if (title) await prisma.homeTrainingPlan.update({ where: { id: planId }, data: { title } });

    await prisma.$executeRaw`
      INSERT INTO "HomePlanLibraryMeta" ("planId", "favorite", "archived", "folder", "updatedAt")
      VALUES (${planId}, ${favorite}, ${archived}, ${folder}, CURRENT_TIMESTAMP)
      ON CONFLICT ("planId") DO UPDATE SET
        "favorite" = EXCLUDED."favorite",
        "archived" = EXCLUDED."archived",
        "folder" = EXCLUDED."folder",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Home library PATCH failed", error);
    return NextResponse.json({ error: "Plan konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const planId = Number(body.planId);
    const playerId = Number(body.playerId);
    if (!Number.isInteger(planId) || !Number.isInteger(playerId)) return NextResponse.json({ error: "Plan fehlt." }, { status: 400 });

    const plan = await prisma.homeTrainingPlan.findFirst({ where: { id: planId, playerId }, select: { id: true } });
    if (!plan) return NextResponse.json({ error: "Plan wurde nicht gefunden." }, { status: 404 });

    const sessions = await prisma.homeTrainingSession.count({ where: { homeTrainingPlanId: planId } });
    if (sessions > 0) {
      await prisma.$executeRaw`
        INSERT INTO "HomePlanLibraryMeta" ("planId", "archived", "updatedAt")
        VALUES (${planId}, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("planId") DO UPDATE SET "archived" = true, "updatedAt" = CURRENT_TIMESTAMP
      `;
      return NextResponse.json({ archived: true });
    }

    await prisma.homeTrainingPlan.delete({ where: { id: planId } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Home library DELETE failed", error);
    return NextResponse.json({ error: "Plan konnte nicht entfernt werden." }, { status: 500 });
  }
}
