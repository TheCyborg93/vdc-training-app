CREATE TABLE "PlayerGoal" (
  "id" SERIAL NOT NULL,
  "playerId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "targetAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlayerGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerGoal_metric_check" CHECK ("metric" IN ('WEEKLY_SESSIONS', 'MONTHLY_RESULTS', 'CHECKOUT_RATE', 'BEST_SCORE', 'WEEK_STREAK')),
  CONSTRAINT "PlayerGoal_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  CONSTRAINT "PlayerGoal_target_check" CHECK ("targetValue" > 0),
  CONSTRAINT "PlayerGoal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PlayerGoal_playerId_status_idx" ON "PlayerGoal"("playerId", "status");
CREATE INDEX "PlayerGoal_targetAt_idx" ON "PlayerGoal"("targetAt");
