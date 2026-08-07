-- Normalize legacy Catch40 exercise definitions so the runtime always opens the SCORE input.
-- This migration is idempotent and does not touch exercise results.

UPDATE "Exercise"
SET
  "engine" = 'CATCH_40'::"ExerciseEngine",
  "resultType" = 'SCORE_0_TO_180'::"ExerciseResultType",
  "resultConfigJson" = jsonb_set(
    COALESCE("resultConfigJson"::jsonb, '{}'::jsonb),
    '{engineType}',
    '"CATCH_40"'::jsonb,
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "engine" = 'CATCH_40'::"ExerciseEngine"
  OR lower(regexp_replace("name", '[^a-zA-Z0-9]+', '', 'g')) IN ('catch40', 'catchforty');
