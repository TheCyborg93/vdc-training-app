export type SummaryResult = {
  roundNumber: number;
  calculatedScore: number | null;
  valueJson: unknown;
};

export type SummaryState = {
  kind?: string;
  score?: number;
  hits?: number;
  dartsThrown?: number;
  visit?: number;
  target?: string;
  targetIndex?: number;
  completed?: boolean;
};

export type ExerciseSummary = {
  title: string;
  kind: string;
  metrics: { label: string; value: string; detail?: string }[];
  highlight: string;
};

function valueObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decimal(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function createExerciseSummary(exerciseName: string, kind: string, results: SummaryResult[], state: SummaryState): ExerciseSummary {
  const active = results.filter((result) => result.valueJson != null);
  const visits = active.length;
  const darts = state.dartsThrown ?? visits * 3;
  const scores = active.map((result) => result.calculatedScore).filter((score): score is number => typeof score === "number");
  const total = scores.reduce((sum, score) => sum + score, 0);
  const highest = scores.length ? Math.max(...scores) : 0;

  if (kind === "BOB27") {
    const hitCounts = active.map((result) => number(valueObject(result.valueJson).hits));
    const totalHits = hitCounts.reduce((sum, hits) => sum + hits, 0);
    const reached = Math.min(21, state.targetIndex == null ? visits : state.targetIndex + 1);
    return {
      title: exerciseName,
      kind,
      metrics: [
        { label: "Endpunktzahl", value: String(state.score ?? 0) },
        { label: "Doppel erreicht", value: `${reached} / 21` },
        { label: "Treffer", value: String(totalHits), detail: `${darts} Darts` },
        { label: "Trefferquote", value: darts ? `${decimal(totalHits / darts * 100)} %` : "0,00 %" },
      ],
      highlight: (state.score ?? 0) > 0 ? `Bob’s 27 mit ${state.score} Punkten beendet.` : `Ausgeschieden bei ${state.target ?? "einem Doppel"}.`,
    };
  }

  if (kind === "SCORING") {
    const average = visits ? total / visits : 0;
    const count100 = scores.filter((score) => score >= 100 && score < 140).length;
    const count140 = scores.filter((score) => score >= 140 && score < 180).length;
    const count180 = scores.filter((score) => score === 180).length;
    return {
      title: exerciseName,
      kind,
      metrics: [
        { label: "3-Dart-Average", value: decimal(average) },
        { label: "Beste Aufnahme", value: String(highest) },
        { label: "100+ / 140+", value: `${count100} / ${count140}` },
        { label: "180er", value: String(count180), detail: `${visits} Aufnahmen` },
      ],
      highlight: `Ø ${decimal(average)} über ${visits} Aufnahmen.`,
    };
  }

  if (kind === "X01") {
    const busts = active.filter((result) => Boolean(valueObject(result.valueJson).bust)).length;
    const checkout = active.some((result) => Boolean(valueObject(result.valueJson).checkout));
    const average = visits ? total / visits : 0;
    return {
      title: exerciseName,
      kind,
      metrics: [
        { label: "3-Dart-Average", value: decimal(average) },
        { label: "Aufnahmen", value: String(visits), detail: `${darts} Darts` },
        { label: "Busts", value: String(busts) },
        { label: "Checkout", value: checkout ? "Erfolgreich" : "Nicht beendet" },
      ],
      highlight: checkout ? `Ausgecheckt nach ${visits} Aufnahmen.` : `Restscore ${state.score ?? "–"}.`,
    };
  }

  if (kind.startsWith("AROUND_")) {
    const totalHits = active.reduce((sum, result) => sum + number(valueObject(result.valueJson).hits), 0);
    return {
      title: exerciseName,
      kind,
      metrics: [
        { label: "Benötigte Aufnahmen", value: String(visits) },
        { label: "Geworfene Darts", value: String(darts) },
        { label: "Treffer", value: String(totalHits) },
        { label: "Trefferquote", value: darts ? `${decimal(totalHits / darts * 100)} %` : "0,00 %" },
      ],
      highlight: state.completed ? `Alle Ziele in ${visits} Aufnahmen abgeschlossen.` : `Beendet bei ${state.target ?? "unbekannt"}.`,
    };
  }

  if (kind === "SHANGHAI" || kind === "JDC_CHALLENGE") {
    const bonuses = active.filter((result) => number(valueObject(result.valueJson).bonus) > 0).length;
    return {
      title: exerciseName,
      kind,
      metrics: [
        { label: "Gesamtpunkte", value: String(state.score ?? total) },
        { label: "Beste Runde", value: String(highest) },
        { label: "Bonusrunden", value: String(bonuses) },
        { label: "Aufnahmen", value: String(visits) },
      ],
      highlight: `${state.score ?? total} Punkte erzielt.`,
    };
  }

  const totalHits = active.reduce((sum, result) => sum + number(valueObject(result.valueJson).hits), 0);
  return {
    title: exerciseName,
    kind,
    metrics: [
      { label: "Aufnahmen", value: String(visits) },
      { label: "Geworfene Darts", value: String(darts) },
      { label: "Gesamtwert", value: decimal(total) },
      { label: "Treffer", value: String(totalHits) },
    ],
    highlight: `${visits} Aufnahmen abgeschlossen.`,
  };
}
