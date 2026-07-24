import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("Player API error:", error);
  return NextResponse.json(
    { error: "Die Datenbank ist aktuell nicht erreichbar. Bitte prüfe die Vercel-Umgebungsvariablen DATABASE_URL und DIRECT_URL." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: [{ active: "desc" }, { displayName: "asc" }]
    });
    return NextResponse.json(players);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const displayName = String(body.displayName ?? "").trim() || `${firstName} ${lastName}`.trim();
    const skillLevel = body.skillLevel === "" || body.skillLevel == null ? null : Number(body.skillLevel);

    if (!firstName || !lastName || !displayName) {
      return NextResponse.json(
        { error: "Vorname, Nachname und Anzeigename sind erforderlich." },
        { status: 400 }
      );
    }

    if (skillLevel !== null && (!Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > 10)) {
      return NextResponse.json(
        { error: "Die Leistungsstufe muss zwischen 1 und 10 liegen." },
        { status: 400 }
      );
    }

    const player = await prisma.player.create({
      data: { firstName, lastName, displayName, skillLevel, active: true }
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
