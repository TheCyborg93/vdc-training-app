import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const EXPECTED_TABLES = [
  "User",
  "Player",
  "Board",
  "ExerciseCategory",
  "Exercise",
  "ExerciseCategoryLink",
  "TrainingPlan",
  "TrainingPlanExercise",
  "TrainingDay",
  "TrainingDayPlayer",
  "TrainingDayBoard",
  "BoardAssignment",
  "BoardSession",
  "ExerciseResult",
  "HomeTrainingPlan",
  "HomeTrainingSession",
  "HomeExerciseResult",
  "ResultAudit",
  "DomainEventRecord",
  "TrainingAttendance",
  "BackgroundJob",
  "PlayerPerformanceSnapshot",
  "PlayerTargetStatistic",
  "PlayerTrainingTrend",
] as const;

const IMPORTANT_INDEXES = [
  "TrainingDay_status_trainingDate_idx",
  "ExerciseResult_playerId_createdAt_idx",
  "ExerciseResult_exerciseId_createdAt_idx",
  "HomeTrainingSession_playerId_startedAt_idx",
  "HomeExerciseResult_playerId_createdAt_idx",
  "PlayerPerformanceSnapshot_playerId_periodDays_key",
  "PlayerTargetStatistic_identity_key",
  "PlayerTrainingTrend_identity_key",
] as const;

type TableRow = { table_name: string };
type IndexRow = { indexname: string };
type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

async function requireAdmin() {
  const trainer = await getAuthenticatedTrainer();
  return trainer?.role === "ADMIN" ? trainer : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nur Administratoren dürfen den Datenbankstatus prüfen." }, { status: 403 });
  }

  try {
    const [tableRows, indexRows, migrationRows] = await Promise.all([
      prisma.$queryRaw<TableRow[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `,
      prisma.$queryRaw<IndexRow[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
      `,
      prisma.$queryRaw<MigrationRow[]>`
        SELECT migration_name, finished_at, rolled_back_at, logs
        FROM "_prisma_migrations"
        ORDER BY started_at DESC
        LIMIT 100
      `,
    ]);

    const existingTables = new Set(tableRows.map((row) => row.table_name));
    const existingIndexes = new Set(indexRows.map((row) => row.indexname));
    const missingTables = EXPECTED_TABLES.filter((table) => !existingTables.has(table));
    const missingIndexes = IMPORTANT_INDEXES.filter((index) => !existingIndexes.has(index));
    const failedMigrations = migrationRows.filter((migration) => !migration.finished_at && !migration.rolled_back_at);

    const status = missingTables.length === 0 && failedMigrations.length === 0
      ? missingIndexes.length === 0 ? "HEALTHY" : "WARNING"
      : "CRITICAL";

    return NextResponse.json({
      status,
      checkedAt: new Date().toISOString(),
      tables: {
        expected: EXPECTED_TABLES.length,
        present: EXPECTED_TABLES.length - missingTables.length,
        missing: missingTables,
      },
      indexes: {
        checked: IMPORTANT_INDEXES.length,
        present: IMPORTANT_INDEXES.length - missingIndexes.length,
        missing: missingIndexes,
      },
      migrations: {
        checked: migrationRows.length,
        failed: failedMigrations.map((migration) => ({
          name: migration.migration_name,
          logs: migration.logs,
        })),
        latest: migrationRows.slice(0, 10).map((migration) => ({
          name: migration.migration_name,
          finishedAt: migration.finished_at?.toISOString() ?? null,
          rolledBackAt: migration.rolled_back_at?.toISOString() ?? null,
        })),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Database health audit failed", error, { adminId: admin.id });
    return NextResponse.json({ error: "Datenbankprüfung konnte nicht ausgeführt werden." }, { status: 500 });
  }
}
