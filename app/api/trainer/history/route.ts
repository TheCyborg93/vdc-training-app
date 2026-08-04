import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { getTrainingHistory, type TrainingHistoryType } from "@/lib/history/training-history";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "lhr1";

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const type = rawType === "CLUB" || rawType === "HOME" ? rawType as TrainingHistoryType : undefined;
  const playerId = Number(url.searchParams.get("playerId"));
  const periodDays = Number(url.searchParams.get("periodDays"));
  const limit = Number(url.searchParams.get("limit"));
  const offset = Number(url.searchParams.get("offset"));

  try {
    const history = await getTrainingHistory({
      type,
      playerId: Number.isInteger(playerId) && playerId > 0 ? playerId : undefined,
      periodDays: Number.isInteger(periodDays) ? periodDays : undefined,
      limit: Number.isInteger(limit) ? limit : undefined,
      offset: Number.isInteger(offset) ? offset : undefined,
      query: url.searchParams.get("query") ?? undefined,
    });
    return NextResponse.json(history, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    logger.error("Training history failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Trainingshistorie konnte nicht geladen werden." }, { status: 500 });
  }
}
