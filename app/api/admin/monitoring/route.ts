import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { getMonitoringSnapshot } from "@/lib/monitoring/system-health";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer || trainer.role !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren dürfen das Monitoring öffnen." }, { status: 403 });
  }

  try {
    const snapshot = await getMonitoringSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Admin monitoring snapshot failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Monitoringdaten konnten nicht geladen werden." }, { status: 500 });
  }
}
