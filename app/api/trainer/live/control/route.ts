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

    const result = await executeLiveBoardAction(parsed.data);
    logger.info("Live board action completed", {
      trainerId: trainer.id,
      boardSessionId: parsed.data.boardSessionId,
      action: parsed.data.action,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LiveTrainingControlError) {
      logger.warn("Live board action rejected", {
        trainerId: trainer.id,
        status: error.status,
        reason: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logger.error("Live board action failed", error, { trainerId: trainer.id });
    return NextResponse.json(
      { error: "Traineraktion konnte nicht ausgeführt werden." },
      { status: 500 },
    );
  }
}
