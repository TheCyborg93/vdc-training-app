import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import {
  claimNextBackgroundJob,
  completeBackgroundJob,
  failBackgroundJob,
  insertBackgroundJob,
  recoverStuckBackgroundJobs,
} from "@/lib/jobs/job-repository";
import type {
  BackgroundJobHandler,
  BackgroundJobPayloadMap,
  BackgroundJobType,
  EnqueueBackgroundJobInput,
  StoredBackgroundJob,
} from "@/lib/jobs/types";

type RuntimeHandler = (job: StoredBackgroundJob) => Promise<unknown>;
type HandlerRegistry = Partial<Record<BackgroundJobType, RuntimeHandler>>;

const globalForJobs = globalThis as typeof globalThis & {
  vdcBackgroundJobHandlers?: HandlerRegistry;
};

const handlers = globalForJobs.vdcBackgroundJobHandlers ?? {};
if (process.env.NODE_ENV !== "production") globalForJobs.vdcBackgroundJobHandlers = handlers;

export function registerBackgroundJobHandler<TType extends BackgroundJobType>(
  type: TType,
  handler: BackgroundJobHandler<TType>,
) {
  handlers[type] = handler as RuntimeHandler;
}

export async function enqueueBackgroundJob<TType extends BackgroundJobType>(
  input: EnqueueBackgroundJobInput<TType>,
) {
  const job = await insertBackgroundJob(randomUUID(), input);
  logger.info("Background job queued", {
    jobId: job.id,
    jobType: job.type,
    priority: job.priority,
    correlationId: job.correlationId,
  });
  return job;
}

async function executeJob(job: StoredBackgroundJob) {
  const handler = handlers[job.type];

  if (!handler) {
    throw new Error(`Kein Handler für Hintergrundjob ${job.type} registriert.`);
  }

  const result = await handler(job);
  await completeBackgroundJob(job.id, result);
  logger.info("Background job completed", {
    jobId: job.id,
    jobType: job.type,
    attempts: job.attempts,
  });
}

export async function processBackgroundJobs(input?: {
  limit?: number;
  workerId?: string;
}) {
  const limit = Math.min(50, Math.max(1, input?.limit ?? 10));
  const workerId = input?.workerId ?? `worker-${randomUUID()}`;
  const recovered = await recoverStuckBackgroundJobs();
  const results: Array<{
    jobId: string;
    type: BackgroundJobType;
    processed: boolean;
    error?: string;
  }> = [];

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextBackgroundJob(workerId);
    if (!job) break;

    try {
      await executeJob(job);
      results.push({ jobId: job.id, type: job.type, processed: true });
    } catch (error) {
      await failBackgroundJob(job, error);
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Background job failed", error, {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
      });
      results.push({
        jobId: job.id,
        type: job.type,
        processed: false,
        error: message,
      });
    }
  }

  return {
    workerId,
    recovered,
    selected: results.length,
    processed: results.filter((item) => item.processed).length,
    failed: results.filter((item) => !item.processed).length,
    results,
  };
}

export type QueuePayload<TType extends BackgroundJobType> = BackgroundJobPayloadMap[TType];
