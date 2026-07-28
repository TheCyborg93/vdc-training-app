import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { logger } from "@/lib/logger";
import {
  executeLiveBoardAction,
  LiveTrainingControlError,
} from "@/lib/services/live-training-control-service";
import { liveBoardActionSchema } from "@/lib/validators/live-training-control";

export async function POST(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) {
    return NextResponse.json(
      { error: "Keine Berechtigung für diese Traineraktion." },
      { status: 403 },
    );
  }

  const correlationId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const body = await request.json();
    const parsed = liveBoardActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Ungültige Traineraktion.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await executeLiveBoardAction(parsed.data, {
      actorId: trainer.id,
      correlationId,
    });
    logger.info("Live board action completed", {
      trainerId: trainer.id,
      boardSessionId: parsed.data.boardSessionId,
      action: parsed.data.action,
      correlationId,
    });

    return NextResponse.json(result, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof LiveTrainingControlError) {
      logger.warn("Live board action rejected", {
        trainerId: trainer.id,
        status: error.status,
        reason: error.message,
        correlationId,
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "x-request-id": correlationId } },
      );
    }

    logger.error("Live board action failed", error, { trainerId: trainer.id, correlationId });
    return NextResponse.json(
      { error: "Traineraktion konnte nicht ausgeführt werden." },
      { status: 500, headers: { "x-request-id": correlationId } },
    );
  }
}
