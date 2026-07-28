import type { DomainEvent } from "@/lib/events/types";
import { enqueueBackgroundJob } from "@/lib/jobs/job-queue";

export async function enqueueJobsForDomainEvent(event: DomainEvent) {
  if (event.name !== "training.finished") return;

  const payload = event.payload as Record<string, unknown>;
  const trainingDayId = Number(payload.trainingDayId);
  if (!Number.isInteger(trainingDayId) || trainingDayId <= 0) return;

  await Promise.all([
    enqueueBackgroundJob({
      type: "ANALYTICS_REFRESH",
      payload: { trainingDayId },
      priority: 20,
      createdById: event.metadata.actorId,
      correlationId: event.metadata.correlationId,
      dedupeKey: `analytics-refresh:${trainingDayId}`,
    }),
    enqueueBackgroundJob({
      type: "TRAINING_REPORT",
      payload: { trainingDayId, format: "JSON" },
      priority: 30,
      createdById: event.metadata.actorId,
      correlationId: event.metadata.correlationId,
      dedupeKey: `training-report:${trainingDayId}`,
    }),
  ]);
}
