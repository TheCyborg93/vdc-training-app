import { z } from "zod";

const planItemSchema = z.object({
  exerciseId: z.coerce.number().int().positive(),
  durationMin: z.coerce.number().int().min(1).max(240),
});

export const trainingPlanInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  goal: z.string().trim().min(2).max(80),
  durationMin: z.coerce.number().int().min(10).max(360),
  items: z.array(planItemSchema).min(1).max(60),
});

export const trainingPlanIdSchema = z.coerce.number().int().positive();

export type TrainingPlanInput = z.infer<typeof trainingPlanInputSchema>;
