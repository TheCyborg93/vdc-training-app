CREATE TABLE "HomeTrainingSchedule" (
  "id" SERIAL NOT NULL,
  "playerId" INTEGER NOT NULL,
  "homeTrainingPlanId" INTEGER,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeTrainingSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeTrainingSchedule_playerId_scheduledFor_idx"
  ON "HomeTrainingSchedule"("playerId", "scheduledFor");

ALTER TABLE "HomeTrainingSchedule"
  ADD CONSTRAINT "HomeTrainingSchedule_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeTrainingSchedule"
  ADD CONSTRAINT "HomeTrainingSchedule_homeTrainingPlanId_fkey"
  FOREIGN KEY ("homeTrainingPlanId") REFERENCES "HomeTrainingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
