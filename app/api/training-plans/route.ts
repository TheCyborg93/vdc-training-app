import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { logger } from "@/lib/logger";
import {
  createTrainingPlanDraft,
  listTrainingPlans,
  TrainingPlanServiceError,
} from "@/lib/services/training-plan-service";
import { trainingPlanInputSchema } from "@/lib/validators/training-plan";

export async function GET() {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Trainingspläne." }, { status: 403 });

  try {
    return NextResponse.json(await listTrainingPlans());
  } catch (error) {
    logger.error("Training plan list failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Trainingspläne konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Trainingspläne." }, { status: 403 });

  try {
    const parsed = trainingPlanInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Titel, Trainingsziel, Dauer und mindestens eine gültige Übung sind erforderlich.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const plan = await createTrainingPlanDraft(parsed.data, trainer.id);
    logger.info("Training plan draft created", { trainerId: trainer.id, trainingPlanId: plan.id });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof TrainingPlanServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("Training plan creation failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Trainingsplan konnte nicht gespeichert werden." }, { status: 500 });
  }
}
