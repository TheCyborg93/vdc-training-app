CREATE TYPE "ActivityAudience" AS ENUM ('TRAINER', 'ADMIN', 'ALL');
CREATE TYPE "ActivityTone" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

CREATE TABLE "EventActivity" (
  "id" SERIAL NOT NULL,
  "eventId" TEXT NOT NULL,
  "projectionKey" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "trainingDayId" INTEGER,
  "boardSessionId" INTEGER,
  "actorId" INTEGER,
  "audience" "ActivityAudience" NOT NULL DEFAULT 'TRAINER',
  "tone" "ActivityTone" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dataJson" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppNotification" (
  "id" SERIAL NOT NULL,
  "eventId" TEXT NOT NULL,
  "projectionKey" TEXT NOT NULL,
  "recipientUserId" INTEGER,
  "audience" "ActivityAudience" NOT NULL DEFAULT 'TRAINER',
  "tone" "ActivityTone" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventActivity_eventId_projectionKey_key" ON "EventActivity"("eventId", "projectionKey");
CREATE INDEX "EventActivity_trainingDayId_occurredAt_idx" ON "EventActivity"("trainingDayId", "occurredAt");
CREATE INDEX "EventActivity_audience_occurredAt_idx" ON "EventActivity"("audience", "occurredAt");

CREATE UNIQUE INDEX "AppNotification_eventId_projectionKey_recipientUserId_key" ON "AppNotification"("eventId", "projectionKey", "recipientUserId");
CREATE INDEX "AppNotification_recipientUserId_readAt_createdAt_idx" ON "AppNotification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "AppNotification_audience_createdAt_idx" ON "AppNotification"("audience", "createdAt");

ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
