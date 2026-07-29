ALTER TYPE "ExerciseEngine" ADD VALUE IF NOT EXISTS 'CATCH_40';

UPDATE "Exercise"
SET "engine" = 'CATCH_40'
WHERE LOWER("name") LIKE '%catch 40%';
