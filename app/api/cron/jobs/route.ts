import { NextResponse } from "next/server";
import { processBackgroundJobs } from "@/lib/jobs/job-queue";
import { registerCoreBackgroundJobHandlers } from "@/lib/jobs/register-core-job-handlers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    logger.warn("Background job cron rejected", {
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Cron-Aufruf nicht autorisiert." }, { status: 401 });
  }

  try {
    registerCoreBackgroundJobHandlers();
    const result = await processBackgroundJobs({
      limit: 20,
      workerId: `vercel-cron-${crypto.randomUUID()}`,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Background job cron failed", error);
    return NextResponse.json(
      { error: "Hintergrundjobs konnten nicht verarbeitet werden." },
      { status: 500 },
    );
  }
}
