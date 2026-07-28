import { NextResponse } from "next/server";
import { getMonitoringSnapshot } from "@/lib/monitoring/system-health";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getMonitoringSnapshot();
    return NextResponse.json(snapshot, {
      status: snapshot.status === "unhealthy" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.error("Deep health check failed", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        checkedAt: new Date().toISOString(),
        error: "Die ausführliche Systemprüfung ist fehlgeschlagen.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
