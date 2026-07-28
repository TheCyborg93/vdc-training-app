import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  BackgroundJobStatus,
  BackgroundJobType,
  EnqueueBackgroundJobInput,
  StoredBackgroundJob,
} from "@/lib/jobs/types";

type JobRow = {
  id: string;
  type: string;
  status: string;
  payloadJson: Prisma.JsonValue;
  resultJson: Prisma.JsonValue | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  completedAt: Date | null;
  lastError: string | null;
  createdById: number | null;
  correlationId: string | null;
  dedupeKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: JobRow): StoredBackgroundJob {
  return {
    id: row.id,
    type: row.type as BackgroundJobType,
    status: row.status as BackgroundJobStatus,
    payload: row.payloadJson as StoredBackgroundJob["payload"],
    result: row.resultJson,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    completedAt: row.completedAt,
    lastError: row.lastError,
    createdById: row.createdById,
    correlationId: row.correlationId,
    dedupeKey: row.dedupeKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insertBackgroundJob<TType extends BackgroundJobType>(
  id: string,
  input: EnqueueBackgroundJobInput<TType>,
) {
  const payloadJson = JSON.stringify(input.payload);
  const rows = await prisma.$queryRaw<JobRow[]>`
    WITH inserted AS (
      INSERT INTO "BackgroundJob" (
        "id", "type", "payloadJson", "priority", "maxAttempts", "runAt",
        "createdById", "correlationId", "dedupeKey", "updatedAt"
      ) VALUES (
        ${id}, ${input.type}, CAST(${payloadJson} AS JSONB), ${input.priority ?? 100},
        ${input.maxAttempts ?? 5}, ${input.runAt ?? new Date()}, ${input.createdById ?? null},
        ${input.correlationId ?? null}, ${input.dedupeKey ?? null}, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("dedupeKey") WHERE "dedupeKey" IS NOT NULL DO NOTHING
      RETURNING *
    )
    SELECT * FROM inserted
    UNION ALL
    SELECT * FROM "BackgroundJob"
    WHERE ${input.dedupeKey ?? null}::TEXT IS NOT NULL
      AND "dedupeKey" = ${input.dedupeKey ?? null}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error("Hintergrundjob konnte nicht angelegt werden.");
  return mapRow(rows[0]);
}

export async function recoverStuckBackgroundJobs() {
  return prisma.$executeRaw`
    UPDATE "BackgroundJob"
    SET "status" = 'RETRY', "lockedAt" = NULL, "lockedBy" = NULL,
        "runAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP,
        "lastError" = COALESCE("lastError", 'Verarbeitung wurde unterbrochen.')
    WHERE "status" = 'PROCESSING'
      AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
  `;
}

export async function claimNextBackgroundJob(workerId: string) {
  const rows = await prisma.$queryRaw<JobRow[]>`
    WITH candidate AS (
      SELECT "id"
      FROM "BackgroundJob"
      WHERE "status" IN ('PENDING', 'RETRY')
        AND "runAt" <= CURRENT_TIMESTAMP
      ORDER BY "priority" ASC, "runAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "BackgroundJob" AS job
    SET "status" = 'PROCESSING', "lockedAt" = CURRENT_TIMESTAMP,
        "lockedBy" = ${workerId}, "attempts" = job."attempts" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job.*
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function completeBackgroundJob(id: string, result: unknown) {
  await prisma.$executeRaw`
    UPDATE "BackgroundJob"
    SET "status" = 'COMPLETED', "resultJson" = CAST(${JSON.stringify(result ?? null)} AS JSONB),
        "completedAt" = CURRENT_TIMESTAMP, "lockedAt" = NULL, "lockedBy" = NULL,
        "lastError" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `;
}

export async function failBackgroundJob(job: StoredBackgroundJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const dead = job.attempts >= job.maxAttempts;
  const delaySeconds = Math.min(3600, 60 * 2 ** Math.max(0, job.attempts - 1));
  await prisma.$executeRaw`
    UPDATE "BackgroundJob"
    SET "status" = ${dead ? "DEAD_LETTER" : "RETRY"},
        "runAt" = CASE WHEN ${dead} THEN "runAt" ELSE CURRENT_TIMESTAMP + (${delaySeconds} * INTERVAL '1 second') END,
        "lockedAt" = NULL, "lockedBy" = NULL, "lastError" = ${message},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${job.id}
  `;
}

export async function listBackgroundJobs(limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT * FROM "BackgroundJob"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
  return rows.map(mapRow);
}

export async function getBackgroundJobSummary() {
  return prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT "status", COUNT(*) AS "count"
    FROM "BackgroundJob"
    GROUP BY "status"
  `;
}
