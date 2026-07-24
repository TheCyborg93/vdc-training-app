import { HomeSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PlanItemInput = { exerciseId?: unknown; durationMin?: unknown };

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: PlanItemInput, position) => ({ exerciseId: Number(item.exerciseId), durationMin: Number(item.durationMin), position }))
    .filter((item) => Number.isInteger(item.exerciseId) && Number.isInteger(item.durationMin) && item.durationMin > 0);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = Number(searchParams.get("playerId"));
    const validPlayerId = Number.isInteger(playerId);

    const [players, exercises, plans, activeSession] = await Promise.all([
      prisma.player.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
      prisma.exercise.findMany({
        where: { active: true, minPlayers: { lte: 1 } },
        orderBy: [{ favorite: "desc" }, { name: "asc" }],
        include: { categories: { include: { category: true } } },
      }),
      validPlayerId
        ? prisma.homeTrainingPlan.findMany({ where: { playerId }, orderBy: { updatedAt: "desc" } })
        : prisma.homeTrainingPlan.findMany({ orderBy: { updatedAt: "desc" }, include: { player: true } }),
      validPlayerId
        ? prisma.homeTrainingSession.findFirst({
            where: { playerId, status: { in: [HomeSessionStatus.RUNNING, HomeSessionStatus.PAUSED] } },
            orderBy: { updatedAt: "desc" },
            include: {
              plan: true,
              results: {
                where: { deletedAt: null },
                orderBy: { createdAt: "asc" },
                include: { exercise: true },
              },
            },
          })
        : null,
    ]);

    return NextResponse.json({ players, exercises, plans, activeSession });
  } catch (error) {
    console.error("Home training GET failed", error);
    return NextResponse.json({ error: "Heimtraining konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = Number(body.playerId);
    const title = String(body.title ?? "").trim();
    const goal = String(body.goal ?? "").trim();
    const durationMin = Number(body.durationMin);
    const items = normalizeItems(body.items);

    if (!Number.isInteger(playerId) || !title || !goal || !Number.isInteger(durationMin) || durationMin < 10 || items.length === 0) {
      return NextResponse.json({ error: "Spieler, Titel, Ziel, Dauer und mindestens eine Übung sind erforderlich." }, { status: 400 });
    }

    const player = await prisma.player.findFirst({ where: { id: playerId, active: true } });
    if (!player) return NextResponse.json({ error: "Spieler wurde nicht gefunden." }, { status: 404 });

    const exerciseIds = [...new Set(items.map((item) => item.exerciseId))];
    const validExercises = await prisma.exercise.findMany({ where: { id: { in: exerciseIds }, active: true } });
    if (validExercises.length !== exerciseIds.length) return NextResponse.json({ error: "Mindestens eine ausgewählte Übung ist nicht mehr verfügbar." }, { status: 409 });

    const plan = await prisma.homeTrainingPlan.create({
      data: { player: { connect: { id: playerId } }, title, goal, durationMin, planJson: items },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Home training POST failed", error);
    return NextResponse.json({ error: "Heimtrainingsplan konnte nicht gespeichert werden." }, { status: 500 });
  }
}
