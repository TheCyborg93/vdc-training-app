import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { logger } from "@/lib/logger";
import {
  removeTrainingPlanDraft,
  TrainingPlanServiceError,
  updateTrainingPlanDraft,
} from "@/lib/services/training-plan-service";
import { trainingPlanIdSchema, trainingPlanInputSchema } from "@/lib/validators/training-plan";

type RouteContext = { params: Promise<{ id: string }> };

async function parsePlanId(context: RouteContext) {
  const { id } = await context.params;
  return trainingPlanIdSchema.safeParse(id);
}

export async function PUT(request: Request, context: RouteContext) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Trainingspläne." }, { status: 403 });

  try {
    const [idResult, body] = await Promise.all([parsePlanId(context), request.json()]);
    const inputResult = trainingPlanInputSchema.safeParse(body);
    if (!idResult.success || !inputResult.success) {
      return NextResponse.json(
        { error: "Titel, Ziel, Dauer und mindestens eine gültige Übung sind erforderlich.", details: inputResult.success ? undefined : inputResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const plan = await updateTrainingPlanDraft(idResult.data, inputResult.data);
    logger.info("Training plan draft updated", { trainerId: trainer.id, trainingPlanId: plan.id });
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof TrainingPlanServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("Training plan update failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Trainingsplan konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Trainingspläne." }, { status: 403 });

  try {
    const idResult = await parsePlanId(context);
    if (!idResult.success) return NextResponse.json({ error: "Ungültiger Trainingsplan." }, { status: 400 });

    const result = await removeTrainingPlanDraft(idResult.data);
    logger.info("Training plan draft deleted", { trainerId: trainer.id, trainingPlanId: idResult.data });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TrainingPlanServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("Training plan deletion failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Trainingsplan konnte nicht gelöscht werden." }, { status: 500 });
  }
}
