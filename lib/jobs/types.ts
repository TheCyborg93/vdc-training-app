export type BackgroundJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "RETRY"
  | "DEAD_LETTER";

export type BackgroundJobType =
  | "EVENT_RETRY"
  | "TRAINING_REPORT"
  | "DATA_EXPORT"
  | "ANALYTICS_REFRESH"
  | "BACKUP";

export type BackgroundJobPayloadMap = {
  EVENT_RETRY: { limit?: number };
  TRAINING_REPORT: { trainingDayId: number; format?: "PDF" | "JSON" };
  DATA_EXPORT: { scope: "TRAINING" | "PLAYER" | "CLUB"; entityId?: number; format: "CSV" | "JSON" | "XLSX" };
  ANALYTICS_REFRESH: { trainingDayId?: number; playerId?: number };
  BACKUP: { scope: "DATABASE" | "TRAINING_DATA" };
};

export type EnqueueBackgroundJobInput<TType extends BackgroundJobType> = {
  type: TType;
  payload: BackgroundJobPayloadMap[TType];
  priority?: number;
  maxAttempts?: number;
  runAt?: Date;
  createdById?: number;
  correlationId?: string;
};

export type StoredBackgroundJob<TType extends BackgroundJobType = BackgroundJobType> = {
  id: string;
  type: TType;
  status: BackgroundJobStatus;
  payload: BackgroundJobPayloadMap[TType];
  result: unknown;
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
  createdAt: Date;
  updatedAt: Date;
};

export type BackgroundJobHandler<TType extends BackgroundJobType> = (
  job: StoredBackgroundJob<TType>,
) => Promise<unknown>;
