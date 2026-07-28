import { processRetryableDomainEvents } from "@/lib/events/retry-service";
import { registerBackgroundJobHandler } from "@/lib/jobs/job-queue";
import {
  handleAnalyticsRefreshJob,
  handleTrainingReportJob,
} from "@/lib/jobs/training-job-handlers";

let registered = false;

export function registerCoreBackgroundJobHandlers() {
  if (registered) return;

  registerBackgroundJobHandler("EVENT_RETRY", async (job) => {
    const limit = Math.min(100, Math.max(1, job.payload.limit ?? 25));
    return processRetryableDomainEvents(limit);
  });

  registerBackgroundJobHandler("ANALYTICS_REFRESH", handleAnalyticsRefreshJob);
  registerBackgroundJobHandler("TRAINING_REPORT", handleTrainingReportJob);

  registered = true;
}
