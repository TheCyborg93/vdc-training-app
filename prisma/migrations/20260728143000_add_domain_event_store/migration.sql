CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'RETRY', 'DEAD_LETTER');

CREATE TABLE "DomainEventRecord" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "metadataJson" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DomainEventRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEventRecord_status_nextAttemptAt_idx"
  ON "DomainEventRecord"("status", "nextAttemptAt");

CREATE INDEX "DomainEventRecord_name_occurredAt_idx"
  ON "DomainEventRecord"("name", "occurredAt");

CREATE INDEX "DomainEventRecord_correlation_idx"
  ON "DomainEventRecord" USING GIN (("metadataJson" -> 'correlationId'));
