import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { findRecentActivities } from "@/lib/events/projection-repository";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für den Live Feed." }, { status: 403 });

  try {
    const url = new URL(request.url);
    const rawTrainingDayId = Number(url.searchParams.get("trainingDayId"));
    const trainingDayId = Number.isInteger(rawTrainingDayId) && rawTrainingDayId > 0 ? rawTrainingDayId : undefined;
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(rawLimit) ? rawLimit : 30;

    const activities = await findRecentActivities({ trainingDayId, audience: "TRAINER", limit });
    return NextResponse.json({
      activities: activities.map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Persistent live activity feed failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Live-Aktivitäten konnten nicht geladen werden." }, { status: 500 });
  }
}
