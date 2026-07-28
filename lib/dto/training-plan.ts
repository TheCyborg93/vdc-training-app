import type { TrainingPlanRecord } from "@/lib/repositories/training-plan-repository";

export function toTrainingPlanDto(plan: TrainingPlanRecord) {
  const archived = plan.trainingDays.some((day) => day.status === "COMPLETED");
  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    durationMin: plan.durationMin,
    status: archived ? "ARCHIVED" : plan.status,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    exercises: plan.exercises.map((entry) => ({
      id: entry.id,
      exerciseId: entry.exerciseId,
      durationMin: entry.durationMin,
      position: entry.position,
      exercise: entry.exercise,
    })),
    trainingDays: plan.trainingDays,
  };
}

export type TrainingPlanDto = ReturnType<typeof toTrainingPlanDto>;
