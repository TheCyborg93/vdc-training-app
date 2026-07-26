export type CoachArea = "SCORING" | "CHECKOUT" | "DOUBLES" | "BULL" | "CONSISTENCY" | "TRAINING";

export const CLUB_TRAINING_SESSIONS_PER_WEEK = 2;
export const COACH_ANALYSIS_DAYS = 90;
export const EXPECTED_ACTIVE_DAYS_90 = Math.round(COACH_ANALYSIS_DAYS / 7 * CLUB_TRAINING_SESSIONS_PER_WEEK);

export type CoachResultInput = {
  calculatedScore: number | null;
  valueJson: unknown;
  createdAt: Date | string;
  exercise: {
    id: number;
    name: string;
    resultType: string;
    engine: string;
    tagsJson: unknown;
    categories: { category: { name: string } }[];
  };
};

export type CoachAreaProfile = {
  key: CoachArea;
  label: string;
  value: number;
  trend: number;
  samples: number;
};

export type CoachRecommendation = {
  area: CoachArea;
  title: string;
  reason: string;
  exerciseNames: string[];
};

export type CoachPlayerProfile = {
  performanceIndex: number;
  areas: CoachAreaProfile[];
  strongest: CoachAreaProfile[];
  weakest: CoachAreaProfile[];
  recommendations: CoachRecommendation[];
  summary: string;
};

const labels: Record<CoachArea, string> = {
  SCORING: "Scoring",
  CHECKOUT: "Checkout",
  DOUBLES: "Doppel",
  BULL: "Bull",
  CONSISTENCY: "Konstanz",
  TRAINING: "Trainingsfleiß",
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function exerciseWords(result: CoachResultInput): string {
  const tags = Array.isArray(result.exercise.tagsJson) ? result.exercise.tagsJson.map(String) : [];
  const categories = result.exercise.categories.map((item) => item.category.name);
  return [result.exercise.name, result.exercise.engine, ...tags, ...categories].join(" ").toLowerCase();
}

function classify(result: CoachResultInput): CoachArea[] {
  const words = exerciseWords(result);
  const areas: CoachArea[] = [];
  if (/scoring|x01|301|501|701|treble|sniper|switch|halve|baseball|fives/.test(words)) areas.push("SCORING");
  if (/checkout|finish|catch 40|121|170|61 in|101 in|132/.test(words)) areas.push("CHECKOUT");
  if (/doppel|double|bob|around.*double/.test(words)) areas.push("DOUBLES");
  if (/bull/.test(words)) areas.push("BULL");
  if (!areas.length) areas.push("CONSISTENCY");
  return [...new Set(areas)];
}

function normalizedResult(result: CoachResultInput): number {
  const value = objectValue(result.valueJson);
  const score = result.calculatedScore ?? numberValue(value.score) ?? numberValue(value.points) ?? 0;
  const hits = numberValue(value.hits);
  const checkout = value.checkout === true;
  const marks = numberValue(value.marksAdded ?? value.marks);

  if (checkout) return 90;
  if (result.exercise.resultType === "HITS_0_TO_3" || hits !== null) return clamp(((hits ?? score) / 3) * 100);
  if (result.exercise.resultType === "CHECKOUT") return checkout ? 90 : 25;
  if (marks !== null) return clamp((marks / 3) * 100);
  if (/X01|SCORING/.test(result.exercise.engine)) return clamp((score / 100) * 100);
  return clamp(score <= 3 ? score / 3 * 100 : score <= 100 ? score : score / 1.8);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function areaRecommendation(area: CoachArea): CoachRecommendation {
  const map: Record<CoachArea, CoachRecommendation> = {
    SCORING: { area, title: "Scoring stabilisieren", reason: "Der Scoring-Wert liegt aktuell unter deinen übrigen Leistungsbereichen.", exerciseNames: ["100 Darts at 20", "Sniper - High Scoring", "Switch - 20 & 19"] },
    CHECKOUT: { area, title: "Checkout-Wege festigen", reason: "Checkout-Erfolge und Entscheidungsqualität sollten gezielt wiederholt werden.", exerciseNames: ["Catch 40 - Bereich 61 bis 70", "121 - The Checkout Game", "Random Checkout"] },
    DOUBLES: { area, title: "Doppelquote verbessern", reason: "Die Zieltreffer auf Doppel sind aktuell der größte messbare Hebel.", exerciseNames: ["Bob's 27 - Classic", "Double Lock - D16", "Double Lock - D20"] },
    BULL: { area, title: "Bull-Kontrolle erhöhen", reason: "Bull-Treffer sind im Vergleich zu anderen Zielbereichen ausbaufähig.", exerciseNames: ["Bullseye Challenge", "100 Darts at Bullseye", "Finish 50 (Bull)"] },
    CONSISTENCY: { area, title: "Konstanz aufbauen", reason: "Die Ergebnisse schwanken innerhalb der letzten Einheiten deutlich.", exerciseNames: ["Around the Clock - Singles (Vorwärts)", "Black & White", "Halve It - Track 3"] },
    TRAINING: { area, title: "Regelmäßigkeit halten", reason: "Der Vereinsrhythmus liegt bei zwei Trainingstagen pro Woche. Regelmäßige Teilnahme ist wichtiger als zusätzliche tägliche Einheiten.", exerciseNames: ["Around the Clock - Singles (Vorwärts)", "Double Lock - D16", "61 in 3 Darts"] },
  };
  return map[area];
}

export function buildCoachProfile(results: CoachResultInput[], activeDays: number): CoachPlayerProfile {
  const now = Date.now();
  const recentLimit = now - 30 * 24 * 60 * 60 * 1000;
  const previousLimit = now - 60 * 24 * 60 * 60 * 1000;
  const grouped = new Map<CoachArea, { recent: number[]; previous: number[]; all: number[] }>();

  for (const key of Object.keys(labels) as CoachArea[]) grouped.set(key, { recent: [], previous: [], all: [] });

  for (const result of results) {
    const score = normalizedResult(result);
    const timestamp = new Date(result.createdAt).getTime();
    for (const area of classify(result)) {
      const bucket = grouped.get(area)!;
      bucket.all.push(score);
      if (timestamp >= recentLimit) bucket.recent.push(score);
      else if (timestamp >= previousLimit) bucket.previous.push(score);
    }
  }

  const allScores = results.map(normalizedResult);
  const mean = average(allScores);
  const deviation = allScores.length > 1 ? Math.sqrt(average(allScores.map((value) => (value - mean) ** 2))) : 25;
  grouped.get("CONSISTENCY")!.all.push(clamp(100 - deviation * 1.6));
  grouped.get("CONSISTENCY")!.recent.push(clamp(100 - deviation * 1.6));
  const trainingValue = clamp(activeDays / EXPECTED_ACTIVE_DAYS_90 * 100);
  grouped.get("TRAINING")!.all.push(trainingValue);
  grouped.get("TRAINING")!.recent.push(trainingValue);

  const areas = (Object.keys(labels) as CoachArea[]).map((key) => {
    const bucket = grouped.get(key)!;
    const recent = bucket.recent.length ? average(bucket.recent) : average(bucket.all);
    const previous = bucket.previous.length ? average(bucket.previous) : recent;
    return { key, label: labels[key], value: clamp(recent), trend: Math.round(recent - previous), samples: bucket.all.length };
  });

  const weighted = areas.reduce((sum, area) => {
    const weight = area.key === "SCORING" || area.key === "CHECKOUT" ? 0.23 : area.key === "DOUBLES" ? 0.2 : area.key === "CONSISTENCY" ? 0.16 : area.key === "TRAINING" ? 0.1 : 0.08;
    return sum + area.value * weight;
  }, 0);
  const sorted = [...areas].sort((a, b) => b.value - a.value);
  const weakest = [...areas].filter((area) => area.samples > 0).sort((a, b) => a.value - b.value).slice(0, 3);
  const recommendations = weakest.slice(0, 2).map((area) => areaRecommendation(area.key));
  const strongest = sorted.filter((area) => area.samples > 0).slice(0, 2);
  const summary = results.length
    ? `${strongest[0]?.label ?? "Training"} ist aktuell deine stärkste Disziplin. Der größte Hebel liegt bei ${weakest[0]?.label ?? "Konstanz"}. Grundlage ist ein Soll von zwei Trainingstagen pro Woche.`
    : "Es liegen noch nicht genügend Trainingsergebnisse für eine belastbare Analyse vor.";

  return { performanceIndex: clamp(weighted) * 10, areas, strongest, weakest, recommendations, summary };
}
