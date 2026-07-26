import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const preferredRegion = "lhr1";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });

  const body = await request.json();
  const data: { firstName?: string; lastName?: string; displayName?: string; skillLevel?: null; active?: boolean } = {};

  if (body.firstName !== undefined) {
    const firstName = String(body.firstName).trim();
    if (!firstName) return NextResponse.json({ error: "Der Vorname darf nicht leer sein." }, { status: 400 });
    data.firstName = firstName;
  }

  if (body.dartName !== undefined || body.displayName !== undefined) {
    const dartName = String(body.dartName ?? body.displayName).trim();
    if (!dartName) return NextResponse.json({ error: "Der Dartname darf nicht leer sein." }, { status: 400 });
    const duplicate = await prisma.player.findFirst({
      where: { id: { not: id }, displayName: { equals: dartName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: "Dieser Dartname ist bereits vergeben." }, { status: 409 });
    data.displayName = dartName;
  }

  if (body.active !== undefined) data.active = Boolean(body.active);
  data.lastName = "";
  data.skillLevel = null;

  const player = await prisma.player.update({
    where: { id },
    data,
    select: { id: true, firstName: true, displayName: true, active: true },
  });
  return NextResponse.json(player);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Ungültige Spieler-ID." }, { status: 400 });

  const linkedData = await prisma.player.findUnique({
    where: { id },
    select: {
      _count: { select: { results: true, trainingDayPlayers: true, boardAssignments: true, homePlans: true } },
    },
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
