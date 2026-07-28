import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { logger } from "@/lib/logger";
import {
  getTrainingDayWorkspace,
  publishTrainingDay,
  TrainingDayServiceError,
} from "@/lib/services/training-day-service";
import { publishTrainingDaySchema } from "@/lib/validators/training-day";

export async function GET() {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Keine Berechtigung für den Trainerbereich." }, { status: 403 });
    }

    const workspace = await getTrainingDayWorkspace();
    return NextResponse.json(workspace);
  } catch (error) {
    logger.error("Training day workspace failed", error);
    return NextResponse.json(
      { error: "Daten für den Trainingstag konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Veröffentlichen eines Trainingstags." },
        { status: 403, headers: { "x-request-id": correlationId } },
      );
    }

    const parsed = publishTrainingDaySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Die Angaben für den Trainingstag sind unvollständig oder ungültig.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: { "x-request-id": correlationId } },
      );
    }

    const trainingDay = await publishTrainingDay(parsed.data, {
      actorId: trainer.id,
      correlationId,
    });
    logger.info("Training day published", {
      trainerId: trainer.id,
      trainingDayId: trainingDay.id,
      trainingPlanId: parsed.data.trainingPlanId,
      playerCount: parsed.data.playerIds.length,
      boardCount: parsed.data.boardIds.length,
      correlationId,
    });

    return NextResponse.json(trainingDay, {
      status: 201,
      headers: { "x-request-id": correlationId },
    });
  } catch (error) {
    if (error instanceof TrainingDayServiceError) {
      logger.warn("Training day publish rejected", {
        status: error.status,
        message: error.message,
        correlationId,
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "x-request-id": correlationId } },
      );
    }

    logger.error("Training day publish failed", error, { correlationId });
    return NextResponse.json(
      { error: "Trainingstag konnte nicht veröffentlicht werden." },
      { status: 500, headers: { "x-request-id": correlationId } },
    );
  }
}
