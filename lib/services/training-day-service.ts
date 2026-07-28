import { mapTrainingDayToDto } from "@/lib/dto/training-day";
import {
  createPublishedTrainingDay,
  findTrainingDayById,
  loadTrainingDayWorkspace,
  validateTrainingDayResources,
} from "@/lib/repositories/training-day-repository";
import type { PublishTrainingDayInput } from "@/lib/validators/training-day";

export class TrainingDayServiceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "TrainingDayServiceError";
  }
}

export async function getTrainingDayWorkspace() {
  const [plans, players, boards, trainingDays] = await loadTrainingDayWorkspace();
  return { plans, players, boards, trainingDays };
}

export async function publishTrainingDay(input: PublishTrainingDayInput) {
  const [plan, boards, players] = await validateTrainingDayResources(input);

  if (!plan) {
    throw new TrainingDayServiceError("Der ausgewählte Trainingsplan ist nicht mehr verfügbar.", 409);
  }
  if (boards.length !== input.boardIds.length) {
    throw new TrainingDayServiceError("Mindestens ein ausgewähltes Board ist nicht mehr verfügbar.", 409);
  }
  if (players.length !== input.playerIds.length) {
    throw new TrainingDayServiceError("Mindestens ein ausgewählter Spieler ist nicht mehr verfügbar.", 409);
  }

  const trainingDayId = await createPublishedTrainingDay(input);
  const trainingDay = await findTrainingDayById(trainingDayId);

  if (!trainingDay) {
    throw new TrainingDayServiceError("Der veröffentlichte Trainingstag konnte nicht erneut geladen werden.", 500);
  }

  return mapTrainingDayToDto(trainingDay);
}
