import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { syncExerciseCatalog } from "@/lib/default-exercises";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Nur angemeldete Trainer dürfen den Übungskatalog ersetzen." }, { status: 403 });
    const result = await syncExerciseCatalog(prisma);
    return NextResponse.json({
      ...result,
      message: `100er-Katalog übernommen: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.deleted} alte Übungen gelöscht und ${result.deactivated} historische Übungen deaktiviert.`,
    });
  } catch (error) {
    console.error("Exercise catalog sync failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Der Übungskatalog konnte nicht synchronisiert werden." }, { status: 500 });
  }
}
