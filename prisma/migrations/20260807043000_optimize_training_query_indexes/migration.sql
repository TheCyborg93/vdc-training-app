-- Phase 7 database hardening: indexes only, no data changes.
CREATE INDEX IF NOT EXISTS "Exercise_active_engine_idx" ON "Exercise"("active", "engine");
CREATE INDEX IF NOT EXISTS "ExerciseCategoryLink_categoryId_exerciseId_idx" ON "ExerciseCategoryLink"("categoryId", "exerciseId");

CREATE INDEX IF NOT EXISTS "TrainingPlan_status_updatedAt_idx" ON "TrainingPlan"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "TrainingPlan_createdById_updatedAt_idx" ON "TrainingPlan"("createdById", "updatedAt");
CREATE INDEX IF NOT EXISTS "TrainingPlanExercise_exerciseId_trainingPlanId_idx" ON "TrainingPlanExercise"("exerciseId", "trainingPlanId");

CREATE INDEX IF NOT EXISTS "TrainingDay_status_trainingDate_idx" ON "TrainingDay"("status", "trainingDate");
CREATE INDEX IF NOT EXISTS "TrainingDay_trainingPlanId_trainingDate_idx" ON "TrainingDay"("trainingPlanId", "trainingDate");
CREATE INDEX IF NOT EXISTS "TrainingDayPlayer_playerId_trainingDayId_idx" ON "TrainingDayPlayer"("playerId", "trainingDayId");
CREATE INDEX IF NOT EXISTS "TrainingDayBoard_boardId_trainingDayId_idx" ON "TrainingDayBoard"("boardId", "trainingDayId");
CREATE INDEX IF NOT EXISTS "BoardAssignment_playerId_trainingDayId_idx" ON "BoardAssignment"("playerId", "trainingDayId");
CREATE INDEX IF NOT EXISTS "BoardAssignment_boardId_trainingDayId_idx" ON "BoardAssignment"("boardId", "trainingDayId");
CREATE INDEX IF NOT EXISTS "BoardSession_status_updatedAt_idx" ON "BoardSession"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ExerciseResult_playerId_createdAt_idx" ON "ExerciseResult"("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExerciseResult_exerciseId_createdAt_idx" ON "ExerciseResult"("exerciseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExerciseResult_boardSessionId_createdAt_idx" ON "ExerciseResult"("boardSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExerciseResult_deletedAt_createdAt_idx" ON "ExerciseResult"("deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "HomeTrainingPlan_playerId_updatedAt_idx" ON "HomeTrainingPlan"("playerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "HomeTrainingSession_playerId_startedAt_idx" ON "HomeTrainingSession"("playerId", "startedAt");
CREATE INDEX IF NOT EXISTS "HomeTrainingSession_status_startedAt_idx" ON "HomeTrainingSession"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "HomeTrainingSession_homeTrainingPlanId_startedAt_idx" ON "HomeTrainingSession"("homeTrainingPlanId", "startedAt");
CREATE INDEX IF NOT EXISTS "HomeExerciseResult_playerId_createdAt_idx" ON "HomeExerciseResult"("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "HomeExerciseResult_exerciseId_createdAt_idx" ON "HomeExerciseResult"("exerciseId", "createdAt");
CREATE INDEX IF NOT EXISTS "HomeExerciseResult_homeTrainingSessionId_createdAt_idx" ON "HomeExerciseResult"("homeTrainingSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "HomeExerciseResult_deletedAt_createdAt_idx" ON "HomeExerciseResult"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "ResultAudit_createdAt_idx" ON "ResultAudit"("createdAt");

CREATE INDEX IF NOT EXISTS "PlayerTargetStatistic_category_targetKey_idx" ON "PlayerTargetStatistic"("category", "targetKey");
CREATE INDEX IF NOT EXISTS "PlayerTrainingTrend_trainingDate_idx" ON "PlayerTrainingTrend"("trainingDate");
