import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });

  const body = await request.json();
  const data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    skillLevel?: number | null;
    active?: boolean;
  } = {};

  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim();
  if (body.lastName !== undefined) data.lastName = String(body.lastName).trim();
  if (body.displayName !== undefined) data.displayName = String(body.displayName).trim();
  if (body.skillLevel !== undefined) data.skillLevel = body.skillLevel === "" || body.skillLevel == null ? null : Number(body.skillLevel);
  if (body.active !== undefined) data.active = Boolean(body.active);

  const player = await prisma.player.update({ where: { id }, data });
  return NextResponse.json(player);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });

  const linkedData = await prisma.player.findUnique({
    where: { id },
    select: {
      _count: { select: { results: true, trainingDayPlayers: true, boardAssignments: true, homePlans: true } }
    }
  });

  if (!linkedData) return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });

  const hasHistory = Object.values(linkedData._count).some((count) => count > 0);
  if (hasHistory) {
    const player = await prisma.player.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ player, deactivated: true });
  }

  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
