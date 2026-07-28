import type { TrainingDayDetail } from "@/lib/repositories/training-day-repository";

export type TrainingDayDto = ReturnType<typeof mapTrainingDayToDto>;

export function mapTrainingDayToDto(trainingDay: TrainingDayDetail) {
  return {
    id: trainingDay.id,
    trainingPlanId: trainingDay.trainingPlanId,
    trainingDate: trainingDay.trainingDate,
    status: trainingDay.status,
    publishedAt: trainingDay.publishedAt,
    createdAt: trainingDay.createdAt,
    updatedAt: trainingDay.updatedAt,
    trainingPlan: trainingDay.trainingPlan,
    boards: trainingDay.boards,
    players: trainingDay.players,
    assignments: trainingDay.assignments,
    sessions: trainingDay.sessions,
  };
}
