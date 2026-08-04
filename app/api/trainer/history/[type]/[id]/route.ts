import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { getTrainingHistoryDetail } from "@/lib/history/training-history-detail";
import type { TrainingHistoryType } from "@/lib/history/training-history";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { type: rawType, id: rawId } = await context.params;
  const normalizedType = rawType.toUpperCase();
  const type = normalizedType === "CLUB" || normalizedType === "HOME"
    ? normalizedType as TrainingHistoryType
    : null;
  const id = Number(rawId);

  if (!type || !Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Ungültige Historien-ID." }, { status: 400 });
  }

  try {
    const detail = await getTrainingHistoryDetail(type, id);
    if (!detail) return NextResponse.json({ error: "Trainingseinheit nicht gefunden." }, { status: 404 });
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    logger.error("Training history detail failed", error, { trainerId: trainer.id, type, id });
    return NextResponse.json({ error: "Trainingseinheit konnte nicht geladen werden." }, { status: 500 });
  }
}
