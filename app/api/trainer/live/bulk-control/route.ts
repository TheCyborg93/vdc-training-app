import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für diese Traineraktion." }, { status: 403 });

    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const action = String(body.action ?? "");
    if (!Number.isInteger(trainingDayId)) return NextResponse.json({ error: "Trainingstag ist erforderlich." }, { status: 400 });
    if (!['pause_all', 'resume_all'].includes(action)) return NextResponse.json({ error: "Unbekannte Sammelaktion." }, { status: 400 });

    const trainingDay = await prisma.trainingDay.findUnique({
      where: { id: trainingDayId },
      select: { id: true, status: true },
    });
    if (!trainingDay) return NextResponse.json({ error: "Trainingstag wurde nicht gefunden." }, { status: 404 });

    if (action === 'pause_all') {
      const result = await prisma.boardSession.updateMany({
        where: { trainingDayId, status: 'RUNNING' },
        data: { status: 'PAUSED' },
      });
      return NextResponse.json({ updated: result.count, message: `${result.count} laufende Boards pausiert.` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const boards = await tx.boardSession.updateMany({
        where: { trainingDayId, status: 'PAUSED' },
        data: { status: 'RUNNING' },
      });
      if (boards.count > 0 && trainingDay.status !== 'RUNNING') {
        await tx.trainingDay.update({ where: { id: trainingDayId }, data: { status: 'RUNNING' } });
      }
      return boards;
    });

    return NextResponse.json({ updated: result.count, message: `${result.count} pausierte Boards fortgesetzt.` });
  } catch (error) {
    console.error("Trainer live bulk control failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sammelaktion konnte nicht ausgeführt werden." }, { status: 500 });
  }
}
