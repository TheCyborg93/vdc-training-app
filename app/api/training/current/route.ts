import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const trainingDay = await prisma.trainingDay.findFirst({
      where: { status: { in: ["PUBLISHED", "RUNNING"] } },
      orderBy: [{ trainingDate: "asc" }, { createdAt: "desc" }],
      include: {
        trainingPlan: {
          include: {
            exercises: {
              orderBy: { position: "asc" },
              include: { exercise: true },
            },
          },
        },
        assignments: {
          orderBy: [{ boardId: "asc" }, { position: "asc" }],
          include: { board: true, player: true },
        },
        sessions: {
          orderBy: { boardId: "asc" },
          include: { board: true },
        },
      },
    });

    return NextResponse.json(trainingDay);
  } catch (error) {
    console.error("Current training GET failed", error);
    return NextResponse.json({ error: "Aktuelles Training konnte nicht geladen werden." }, { status: 500 });
  }
}
