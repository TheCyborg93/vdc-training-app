import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Ungültige Board-ID." }, { status: 400 });

    const body = await request.json();
    const data: { name?: string; location?: string | null; active?: boolean; available?: boolean } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Der Boardname darf nicht leer sein." }, { status: 400 });
      data.name = name;
    }
    if (typeof body.location === "string") data.location = body.location.trim() || null;
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.available === "boolean") data.available = body.available;

    const board = await prisma.board.update({ where: { id }, data });
    return NextResponse.json(board);
  } catch (error) {
    console.error("PATCH /api/boards/[id] failed", error);
    return NextResponse.json({ error: "Board konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Ungültige Board-ID." }, { status: 400 });

    const board = await prisma.board.findUnique({
      where: { id },
      include: { _count: { select: { trainingDayBoards: true, sessions: true, assignments: true } } }
    });

    if (!board) return NextResponse.json({ error: "Board wurde nicht gefunden." }, { status: 404 });

    const inUse = board._count.trainingDayBoards + board._count.sessions + board._count.assignments > 0;
    if (inUse) {
      const updated = await prisma.board.update({
        where: { id },
        data: { active: false, available: false }
      });
      return NextResponse.json({ board: updated, deactivated: true });
    }

    await prisma.board.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/boards/[id] failed", error);
    return NextResponse.json({ error: "Board konnte nicht entfernt werden." }, { status: 500 });
  }
}
