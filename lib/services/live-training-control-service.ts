import { createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";
import {
  advanceBoardExercise,
  completeBoardSession,
  findBoardAssignments,
  findBoardSessionForControl,
  resumeBoardAndTraining,
  updateBoardProgress,
  updateBoardStatus,
} from "@/lib/repositories/live-training-control-repository";
import type { LiveBoardActionInput } from "@/lib/validators/live-training-control";

export class LiveTrainingControlError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "LiveTrainingControlError";
  }
}

type ProgressState = {
  order: number[];
  exerciseIndex: number;
  playerIndex: number;
  roundNumber: number;
  playerStates: Record<string, PlayerExerciseState>;
};

function readProgress(value: unknown): ProgressState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];
  const exerciseIndex = Number(data.exerciseIndex);
  const playerIndex = Number(data.playerIndex);
  const roundNumber = Number(data.roundNumber);
  const playerStates = data.playerStates && typeof data.playerStates === "object" && !Array.isArray(data.playerStates)
    ? data.playerStates as Record<string, PlayerExerciseState>
    : {};
  if (!order.length || !Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber, playerStates };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function nextActiveIndex(progress: ProgressState): number {
  for (let offset = 1; offset <= progress.order.length; offset += 1) {
    const index = (progress.playerIndex + offset) % progress.order.length;
    if (!progress.playerStates[String(progress.order[index])]?.completed) return index;
  }
  return progress.playerIndex;
}

function assertExactOrder(requested: number[], validPlayerIds: number[]) {
  if (
    requested.length !== validPlayerIds.length ||
    new Set(requested).size !== requested.length ||
    requested.some((id) => !validPlayerIds.includes(id))
  ) {
    throw new LiveTrainingControlError("Die neue Reihenfolge muss alle Spieler des Boards genau einmal enthalten.", 400);
  }
}

export async function executeLiveBoardAction(input: LiveBoardActionInput) {
  const session = await findBoardSessionForControl(input.boardSessionId);
  if (!session) throw new LiveTrainingControlError("Board-Sitzung wurde nicht gefunden.", 404);

  const assignments = await findBoardAssignments(session.trainingDayId, session.boardId);
  const validPlayerIds = assignments.map((item) => item.playerId);
  const progress = readProgress(session.randomOrderJson);

  if (input.action === "pause") {
    if (session.status !== "RUNNING") throw new LiveTrainingControlError("Nur ein laufendes Board kann pausiert werden.", 409);
    const updated = await updateBoardStatus(session.id, "PAUSED");
    return { session: updated, message: "Board pausiert." };
  }

  if (input.action === "resume") {
    if (session.status !== "PAUSED") throw new LiveTrainingControlError("Dieses Board ist nicht pausiert.", 409);
    const updated = await resumeBoardAndTraining(session.id, session.trainingDayId, session.trainingDay.status);
    return { session: updated, message: "Board fortgesetzt." };
  }

  if (input.action === "finish_board") {
    if (session.status === "COMPLETED") throw new LiveTrainingControlError("Dieses Board-Training ist bereits abgeschlossen.", 409);
    if (session.status === "NOT_STARTED") throw new LiveTrainingControlError("Ein noch nicht gestartetes Board kann nicht abgeschlossen werden.", 409);
    const result = await completeBoardSession({
      boardSessionId: session.id,
      trainingDayId: session.trainingDayId,
      progress: session.randomOrderJson,
    });
    return { completed: true, trainingCompleted: result.trainingCompleted, message: "Board-Training vollständig beendet." };
  }

  if (!progress) {
    throw new LiveTrainingControlError("Das Board wurde noch nicht gestartet oder der Fortschritt ist ungültig.", 409);
  }

  const controllable = session.status === "RUNNING" || session.status === "PAUSED";
  if (!controllable && input.action !== "reorder") {
    throw new LiveTrainingControlError("Das Board muss für diese Aktion laufen oder pausiert sein.", 409);
  }

  if (input.action === "skip") {
    if (session.status !== "RUNNING") throw new LiveTrainingControlError("Spieler können nur bei laufendem Training gewechselt werden.", 409);
    const nextIndex = nextActiveIndex(progress);
    const updatedProgress = { ...progress, playerIndex: nextIndex };
    await updateBoardProgress(session.id, updatedProgress);
    return {
      progress: updatedProgress,
      nextPlayerId: updatedProgress.order[nextIndex],
      message: "Zum nächsten Spieler gewechselt.",
    };
  }

  if (input.action === "reorder") {
    assertExactOrder(input.order, validPlayerIds);
    const currentPlayerId = progress.order[progress.playerIndex];
    const currentIndex = Math.max(0, input.order.indexOf(currentPlayerId));
    const updatedProgress = { ...progress, order: input.order, playerIndex: currentIndex };
    await updateBoardProgress(session.id, updatedProgress);
    return { progress: updatedProgress, message: "Reihenfolge aktualisiert." };
  }

  const exercises = session.trainingDay.trainingPlan.exercises;
  const nextExerciseIndex = progress.exerciseIndex + 1;
  const completed = nextExerciseIndex >= exercises.length;

  if (completed) {
    const result = await completeBoardSession({
      boardSessionId: session.id,
      trainingDayId: session.trainingDayId,
      progress: session.randomOrderJson,
    });
    return {
      completed: true,
      trainingCompleted: result.trainingCompleted,
      message: "Letzte Übung und Board-Training abgeschlossen.",
    };
  }

  const order = shuffle(validPlayerIds);
  const exercise = exercises[nextExerciseIndex].exercise;
  const playerStates = Object.fromEntries(
    order.map((playerId) => [String(playerId), createInitialExerciseState(exercise)]),
  );
  const nextProgress: ProgressState = {
    order,
    exerciseIndex: nextExerciseIndex,
    playerIndex: 0,
    roundNumber: progress.roundNumber + 1,
    playerStates,
  };

  await advanceBoardExercise(session.id, session.status, exercise.id, nextProgress);
  return { completed: false, message: "Übung abgeschlossen. Die nächste Übung ist vorbereitet." };
}
