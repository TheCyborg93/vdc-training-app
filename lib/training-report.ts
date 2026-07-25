import type { Exercise } from "@prisma/client";
import { applyVisit, createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";
import { createExerciseSummary, type ExerciseSummary } from "@/lib/exercise-summary";

export type ReportResult = {
  exerciseId: number;
  playerId: number;
  roundNumber: number;
  calculatedScore: number | null;
  valueJson: unknown;
};

export type ReportExercise = {
  exercise: Exercise;
  position: number;
};

export type TrainingPlayerReport = {
  playerId: number;
  playerName: string;
  exercises: ExerciseSummary[];
  feedback: string;
};

export type TrainingReport = {
  title: string;
  completedAt: string;
  players: TrainingPlayerReport[];
};

function inputValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const object = value as Record<string, unknown>;
  const { progressBefore: _progressBefore, stateBefore: _stateBefore, ...visit } = object;
  return visit;
}

function replayExercise(exercise: Exercise, results: ReportResult[]): PlayerExerciseState {
  let state = createInitialExerciseState(exercise);
  for (const result of results) {
    state = applyVisit(exercise, state, inputValue(result.valueJson)).nextState;
  }
  return state;
}

function metricNumber(summary: ExerciseSummary, label: string): number | null {
  const metric = summary.metrics.find((item) => item.label === label);
  if (!metric) return null;
  const normalized = metric.value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function createCoachFeedback(summaries: ExerciseSummary[]): string {
  if (!summaries.length) return "Für dieses Training liegen noch keine auswertbaren Aufnahmen vor.";

  const scoring = summaries.filter((item) => item.kind === "SCORING");
  const doubles = summaries.filter((item) => item.kind === "BOB27" || item.kind.startsWith("AROUND_") || item.kind === "DOUBLES_ROUNDS");
  const x01 = summaries.filter((item) => item.kind === "X01");
  const averages = scoring.map((item) => metricNumber(item, "3-Dart-Average")).filter((value): value is number => value !== null);
  const hitRates = doubles.map((item) => metricNumber(item, "Trefferquote")).filter((value): value is number => value !== null);

  const parts: string[] = [];
  if (averages.length) {
    const average = averages.reduce((sum, value) => sum + value, 0) / averages.length;
    parts.push(average >= 60
      ? `Das Scoring war mit durchschnittlich ${average.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Punkten sehr stabil.`
      : average >= 45
        ? `Das Scoring bildet mit durchschnittlich ${average.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Punkten eine solide Grundlage.`
        : `Beim Scoring liegt das größte Entwicklungspotenzial; konzentriere dich im nächsten Training auf einen ruhigen Rhythmus und saubere Gruppierungen.`);
  }
  if (hitRates.length) {
    const rate = hitRates.reduce((sum, value) => sum + value, 0) / hitRates.length;
    parts.push(rate >= 30
      ? `Die Doppel- und Zieltreffer waren mit rund ${rate.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % eine Stärke dieses Trainings.`
      : `Die Zieltrefferquote von rund ${rate.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % sollte mit kurzen, regelmäßigen Doppelblöcken weiter verbessert werden.`);
  }
  if (x01.length) {
    const successful = x01.filter((item) => item.metrics.some((metric) => metric.label === "Checkout" && metric.value === "Erfolgreich")).length;
    parts.push(successful
      ? `${successful} X01-Übung${successful === 1 ? " wurde" : "en wurden"} erfolgreich beendet; behalte den Fokus auf klare Stellwege und den ersten Dart aufs Doppel.`
      : "Bei X01 empfiehlt sich als nächster Schwerpunkt das Stellen auf bevorzugte Doppel und ein konsequenter Checkout-Ablauf.");
  }
  if (!parts.length) {
    const completed = summaries.length;
    parts.push(`${completed} Übung${completed === 1 ? " wurde" : "en wurden"} vollständig ausgewertet. Nutze die Einzelwerte, um den nächsten Trainingsschwerpunkt gezielt festzulegen.`);
  }
  parts.push("Empfehlung: Im nächsten Training eine Stärke kurz bestätigen und anschließend den schwächsten Bereich mit einer klar messbaren Übung bearbeiten.");
  return parts.join(" ");
}

export function buildTrainingReport(params: {
  title: string;
  completedAt?: Date | null;
  exercises: ReportExercise[];
  players: { id: number; displayName: string }[];
  results: ReportResult[];
}): TrainingReport {
  const orderedExercises = [...params.exercises].sort((a, b) => a.position - b.position);
  const players = params.players.map((player) => {
    const summaries = orderedExercises.map(({ exercise }) => {
      const exerciseResults = params.results
        .filter((result) => result.playerId === player.id && result.exerciseId === exercise.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);
      const state = replayExercise(exercise, exerciseResults);
      return createExerciseSummary(exercise.name, state.kind, exerciseResults, state);
    });
    return {
      playerId: player.id,
      playerName: player.displayName,
      exercises: summaries,
      feedback: createCoachFeedback(summaries),
    };
  });

  return {
    title: params.title,
    completedAt: (params.completedAt ?? new Date()).toISOString(),
    players,
  };
}
