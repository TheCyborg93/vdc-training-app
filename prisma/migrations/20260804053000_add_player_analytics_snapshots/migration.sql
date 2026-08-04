CREATE TABLE IF NOT EXISTS "PlayerPerformanceSnapshot" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "activeDays" INTEGER NOT NULL DEFAULT 0,
  "sessionCount" INTEGER NOT NULL DEFAULT 0,
  "average" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "first9" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "checkoutRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mpr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "highScore" INTEGER NOT NULL DEFAULT 0,
  "zeroVisits" INTEGER NOT NULL DEFAULT 0,
  "metricsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerPerformanceSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerPerformanceSnapshot_playerId_periodDays_key"
  ON "PlayerPerformanceSnapshot"("playerId", "periodDays");
CREATE INDEX IF NOT EXISTS "PlayerPerformanceSnapshot_generatedAt_idx"
  ON "PlayerPerformanceSnapshot"("generatedAt");

CREATE TABLE IF NOT EXISTS "PlayerTargetStatistic" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "successes" INTEGER NOT NULL DEFAULT 0,
  "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerTargetStatistic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerTargetStatistic_identity_key"
  ON "PlayerTargetStatistic"("playerId", "periodDays", "category", "targetKey");
CREATE INDEX IF NOT EXISTS "PlayerTargetStatistic_player_period_idx"
  ON "PlayerTargetStatistic"("playerId", "periodDays");

CREATE TABLE IF NOT EXISTS "PlayerTrainingTrend" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "trainingDate" DATE NOT NULL,
  "average" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "visits" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerTrainingTrend_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerTrainingTrend_identity_key"
  ON "PlayerTrainingTrend"("playerId", "periodDays", "trainingDate");
CREATE INDEX IF NOT EXISTS "PlayerTrainingTrend_player_period_idx"
  ON "PlayerTrainingTrend"("playerId", "periodDays");
