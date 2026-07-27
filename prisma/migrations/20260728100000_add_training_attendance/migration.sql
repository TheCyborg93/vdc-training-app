CREATE TABLE IF NOT EXISTS "TrainingAttendance" (
  "id" SERIAL PRIMARY KEY,
  "trainingDayId" INTEGER NOT NULL,
  "playerId" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'EXPECTED',
  "checkedInAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingAttendance_trainingDayId_fkey"
    FOREIGN KEY ("trainingDayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrainingAttendance_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingAttendance_trainingDayId_playerId_key"
  ON "TrainingAttendance"("trainingDayId", "playerId");

CREATE INDEX IF NOT EXISTS "TrainingAttendance_trainingDayId_status_idx"
  ON "TrainingAttendance"("trainingDayId", "status");
