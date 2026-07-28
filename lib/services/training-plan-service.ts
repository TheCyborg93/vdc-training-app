import { toTrainingPlanDto } from "@/lib/dto/training-plan";
import {
  createTrainingPlan,
  deleteTrainingPlan,
  findTrainingPlans,
  findTrainingPlanState,
  updateTrainingPlan,
} from "@/lib/repositories/training-plan-repository";
import type { TrainingPlanInput } from "@/lib/validators/training-plan";

export class TrainingPlanServiceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "TrainingPlanServiceError";
  }
}

export async function listTrainingPlans() {
  const plans = await findTrainingPlans();
  return plans.map(toTrainingPlanDto);
}

export async function createTrainingPlanDraft(input: TrainingPlanInput, trainerId: number) {
  const plan = await createTrainingPlan(input, trainerId);
  return toTrainingPlanDto(plan);
}

async function requireEditableDraft(id: number) {
  const existing = await findTrainingPlanState(id);
  if (!existing) throw new TrainingPlanServiceError("Trainingsplan wurde nicht gefunden.", 404);
  if (existing.status !== "DRAFT") {
    throw new TrainingPlanServiceError("Nur unveröffentlichte Entwürfe können verändert werden.", 409);
  }
  return existing;
}

export async function updateTrainingPlanDraft(id: number, input: TrainingPlanInput) {
  await requireEditableDraft(id);
  const plan = await updateTrainingPlan(id, input);
  return toTrainingPlanDto(plan);
}

export async function removeTrainingPlanDraft(id: number) {
  const existing = await requireEditableDraft(id);
  if (existing._count.trainingDays > 0) {
    throw new TrainingPlanServiceError("Ein bereits verwendeter Trainingsplan kann nicht gelöscht werden.", 409);
  }
  await deleteTrainingPlan(id);
  return { deleted: true };
}
