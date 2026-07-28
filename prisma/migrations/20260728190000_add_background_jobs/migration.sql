CREATE TABLE "BackgroundJob" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payloadJson" JSONB NOT NULL,
  "resultJson" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" INTEGER,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackgroundJob_status_runAt_priority_idx"
  ON "BackgroundJob"("status", "runAt", "priority");
CREATE INDEX "BackgroundJob_type_createdAt_idx"
  ON "BackgroundJob"("type", "createdAt");
CREATE INDEX "BackgroundJob_correlationId_idx"
  ON "BackgroundJob"("correlationId");

ALTER TABLE "BackgroundJob"
  ADD CONSTRAINT "BackgroundJob_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
