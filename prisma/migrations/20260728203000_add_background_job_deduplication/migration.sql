ALTER TABLE "BackgroundJob"
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "BackgroundJob_dedupeKey_key"
  ON "BackgroundJob"("dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
