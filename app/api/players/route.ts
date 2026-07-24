import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }] });
  return NextResponse.json(players);
}

export async function POST(request: Request) {
  const body = await request.json();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const displayName = String(body.displayName ?? "").trim() || `${firstName} ${lastName}`.trim();
  const skillLevel = body.skillLevel === "" || body.skillLevel == null ? null : Number(body.skillLevel);

  if (!firstName || !lastName || !displayName) {
    return NextResponse.json({ error: "Vorname, Nachname und Anzeigename sind erforderlich." }, { status: 400 });
  }

  const player = await prisma.player.create({
    data: { firstName, lastName, displayName, skillLevel, active: true }
  });

  return NextResponse.json(player, { status: 201 });
}
