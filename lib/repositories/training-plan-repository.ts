import { prisma } from "@/lib/prisma";
import type { TrainingPlanInput } from "@/lib/validators/training-plan";

const planInclude = {
  exercises: { orderBy: { position: "asc" as const }, include: { exercise: true } },
  trainingDays: { select: { id: true, status: true, trainingDate: true } },
};

function planItems(input: TrainingPlanInput) {
  return input.items.map((item, index) => ({ ...item, position: index + 1 }));
}

export function findTrainingPlans() {
  return prisma.trainingPlan.findMany({ orderBy: { updatedAt: "desc" }, include: planInclude });
}

export function findTrainingPlanState(id: number) {
  return prisma.trainingPlan.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { trainingDays: true } } },
  });
}

export function createTrainingPlan(input: TrainingPlanInput, createdById: number) {
  return prisma.trainingPlan.create({
    data: {
      title: input.title,
      goal: input.goal,
      durationMin: input.durationMin,
      status: "DRAFT",
      createdById,
      exercises: { create: planItems(input) },
    },
    include: planInclude,
  });
}

export function updateTrainingPlan(id: number, input: TrainingPlanInput) {
  return prisma.$transaction(async (tx) => {
    await tx.trainingPlanExercise.deleteMany({ where: { trainingPlanId: id } });
    return tx.trainingPlan.update({
      where: { id },
      data: {
        title: input.title,
        goal: input.goal,
        durationMin: input.durationMin,
        exercises: { create: planItems(input) },
      },
      include: planInclude,
    });
  });
}

export function deleteTrainingPlan(id: number) {
  return prisma.trainingPlan.delete({ where: { id } });
}

export type TrainingPlanRecord = Awaited<ReturnType<typeof createTrainingPlan>>;
