export type ExerciseResultType =
  | "HITS_0_TO_3"
  | "SCORE_0_TO_180"
  | "CHECKOUT"
  | "LEGS"
  | "TIME_BASED"
  | "BOOLEAN"
  | "CUSTOM";

export type NormalizedExerciseResult = {
  value: Record<string, boolean | number | number[] | string>;
  calculatedScore: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Das Ergebnisformat ist ungültig.");
  }
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} ist ungültig.`);
  return number;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

export function normalizeExerciseResult(type: string, rawValue: unknown): NormalizedExerciseResult {
  const value = asRecord(rawValue);

  switch (type as ExerciseResultType) {
    case "HITS_0_TO_3": {
      const hits = finiteNumber(firstDefined(value.hits, value.value), "Trefferzahl");
      if (!Number.isInteger(hits) || hits < 0 || hits > 3) throw new Error("Treffer müssen zwischen 0 und 3 liegen.");
      return { value: { hits }, calculatedScore: hits };
    }

    case "SCORE_0_TO_180": {
      const visits = Array.isArray(value.visits)
        ? value.visits.map((visit) => finiteNumber(visit, "Aufnahme"))
        : [finiteNumber(firstDefined(value.score, value.value), "Score")];
      if (visits.length < 1 || visits.length > 3 || visits.some((score) => !Number.isInteger(score) || score < 0 || score > 180)) {
        throw new Error("Es sind ein bis drei Aufnahmen zwischen 0 und 180 erlaubt.");
      }
      const total = visits.reduce((sum, score) => sum + score, 0);
      const average = Number((total / visits.length).toFixed(2));
      return { value: { visits, total, average, highScore: Math.max(...visits) }, calculatedScore: average };
    }

    case "CHECKOUT": {
      const success = value.checkout === true || value.success === true;
      const darts = finiteNumber(firstDefined(value.dartsUsed, value.darts), "Anzahl Darts");
      if (!Number.isInteger(darts) || darts < 1 || darts > 9) throw new Error("Die Anzahl der Darts muss zwischen 1 und 9 liegen.");
      return { value: { success, checkout: success, darts, dartsUsed: darts }, calculatedScore: success ? 1 : 0 };
    }

    case "BOOLEAN": {
      const success = value.success === true || value.checkout === true;
      return { value: { success }, calculatedScore: success ? 1 : 0 };
    }

    case "LEGS": {
      const legs = finiteNumber(firstDefined(value.legs, value.value), "Legs");
      if (!Number.isInteger(legs) || legs < 0) throw new Error("Legs müssen eine positive ganze Zahl sein.");
      return { value: { legs }, calculatedScore: legs };
    }

    case "TIME_BASED": {
      const seconds = finiteNumber(firstDefined(value.seconds, value.value), "Zeit");
      if (seconds < 0) throw new Error("Die Zeit darf nicht negativ sein.");
      return { value: { seconds }, calculatedScore: seconds };
    }

    case "CUSTOM":
    default: {
      const raw = firstDefined(value.value, value.score, value.hits, value.points, value.marks);
      const numeric = raw === "" || raw === undefined ? Number.NaN : Number(raw);
      return {
        value: {
          ...Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== undefined),
          ) as Record<string, boolean | number | number[] | string>,
          value: Number.isFinite(numeric) ? numeric : String(raw ?? ""),
        },
        calculatedScore: Number.isFinite(numeric) ? numeric : null,
      };
    }
  }
}
