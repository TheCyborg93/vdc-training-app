import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

function errorResponse(error: unknown) {
  console.error("Player API error:", error);
  return NextResponse.json(
    { error: "Die Spielerdaten konnten aktuell nicht geladen oder gespeichert werden." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      select: {
        id: true,
        firstName: true,
        displayName: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            results: true,
            homeResults: true,
            trainingDayPlayers: true,
          },
        },
      },
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
    const dartName = String(body.dartName ?? body.displayName ?? "").trim();

    if (!firstName || !dartName) {
      return NextResponse.json(
        { error: "Vorname und Dartname sind erforderlich." },
        { status: 400 },
      );
    }

    const duplicate = await prisma.player.findFirst({
      where: { displayName: { equals: dartName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Dieser Dartname ist bereits vergeben." }, { status: 409 });
    }

    const player = await prisma.player.create({
      data: {
        firstName,
        lastName: "",
        displayName: dartName,
        skillLevel: null,
        active: true,
      },
      select: { id: true, firstName: true, displayName: true, active: true },
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
