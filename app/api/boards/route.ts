import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const boards = await prisma.board.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });
    return NextResponse.json(boards);
  } catch (error) {
    console.error("GET /api/boards failed", error);
    return NextResponse.json({ error: "Boards konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const location = String(body.location ?? "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "Der Boardname ist erforderlich." }, { status: 400 });
    }

    const board = await prisma.board.create({
      data: { name, location, active: true, available: true }
    });

    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    console.error("POST /api/boards failed", error);
    return NextResponse.json({ error: "Board konnte nicht gespeichert werden." }, { status: 500 });
  }
}
