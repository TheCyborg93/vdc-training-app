import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import {
  getBackgroundJobSummary,
  listBackgroundJobs,
} from "@/lib/jobs/job-repository";
import {
  enqueueBackgroundJob,
  processBackgroundJobs,
} from "@/lib/jobs/job-queue";
import { registerCoreBackgroundJobHandlers } from "@/lib/jobs/register-core-job-handlers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const processSchema = z.object({
  action: z.literal("PROCESS"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const enqueueRetrySchema = z.object({
  action: z.literal("ENQUEUE_EVENT_RETRY"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const enqueueAnalyticsSchema = z.object({
  action: z.literal("ENQUEUE_ANALYTICS_REFRESH"),
  playerId: z.coerce.number().int().positive().optional(),
});

const commandSchema = z.discriminatedUnion("action", [
  processSchema,
  enqueueRetrySchema,
  enqueueAnalyticsSchema,
]);

async function requireAdmin() {
  const trainer = await getAuthenticatedTrainer();
  return trainer?.role === "ADMIN" ? trainer : null;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen Hintergrundjobs einsehen." },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(rawLimit) ? rawLimit : 50;
    const [jobs, summaryRows] = await Promise.all([
      listBackgroundJobs(limit),
      getBackgroundJobSummary(),
    ]);

    const summary = Object.fromEntries(
      summaryRows.map((row) => [row.status, Number(row.count)]),
    );

    return NextResponse.json(
      {
        summary,
        jobs: jobs.map((job) => ({
          ...job,
          runAt: job.runAt.toISOString(),
          lockedAt: job.lockedAt?.toISOString() ?? null,
          completedAt: job.completedAt?.toISOString() ?? null,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("Background job list failed", error, { adminId: admin.id });
    return NextResponse.json(
      { error: "Hintergrundjobs konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen Hintergrundjobs steuern." },
      { status: 403 },
    );
  }

  try {
    const parsed = commandSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültiger Queue-Befehl.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (parsed.data.action === "ENQUEUE_EVENT_RETRY") {
      const job = await enqueueBackgroundJob({
        type: "EVENT_RETRY",
        payload: { limit: parsed.data.limit },
        priority: 20,
        createdById: admin.id,
      });
      return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
    }

    if (parsed.data.action === "ENQUEUE_ANALYTICS_REFRESH") {
      const scope = parsed.data.playerId ? `player-${parsed.data.playerId}` : "club";
      const job = await enqueueBackgroundJob({
        type: "ANALYTICS_REFRESH",
        payload: parsed.data.playerId ? { playerId: parsed.data.playerId } : {},
        priority: 15,
        createdById: admin.id,
        dedupeKey: `analytics-refresh:${scope}`,
      });
      return NextResponse.json({ queued: true, jobId: job.id, scope }, { status: 202 });
    }

    registerCoreBackgroundJobHandlers();
    const result = await processBackgroundJobs({ limit: parsed.data.limit });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Background job command failed", error, { adminId: admin.id });
    return NextResponse.json(
      { error: "Queue-Befehl konnte nicht ausgeführt werden." },
      { status: 500 },
    );
  }
}
