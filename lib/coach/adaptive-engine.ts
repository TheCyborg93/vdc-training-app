import type { CoachArea, CoachPlayerProfile } from "@/lib/ai-coach";

export type AdaptiveExerciseCandidate = {
  id: number;
  name: string;
  description: string | null;
  defaultMinutes: number;
  difficulty: number;
  intensity: number;
  engine: string;
  tags: string[];
  categories: string[];
  favorite: boolean;
};

export type AdaptiveSessionBlock = {
  position: number;
  exerciseId: number;
  exerciseName: string;
  durationMin: number;
  area: CoachArea;
  difficultyLevel: number;
  intensityLevel: number;
  reason: string;
  configuration: Record<string, unknown>;
};

export type AdaptiveSession = {
  durationMin: number;
  difficultyLevel: number;
  workload: "RECOVERY" | "NORMAL" | "INTENSIVE";
  confidence: number;
  focusAreas: CoachArea[];
  blocks: AdaptiveSessionBlock[];
  explanation: string;
};

const areaPatterns: Record<CoachArea, RegExp> = {
  SCORING: /scoring|x01|301|501|701|treble|triple|sniper|switch|halve|baseball|fives/i,
  CHECKOUT: /checkout|finish|catch\s*40|121|170|61\s*in|101\s*in|132/i,
  DOUBLES: /doppel|double|bob|around.*double/i,
  BULL: /bull/i,
  CONSISTENCY: /around|control|rhythm|konstanz|consistency|black\s*&\s*white/i,
  TRAINING: /warm|grundlage|routine|technik|training/i,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function words(exercise: AdaptiveExerciseCandidate) {
  return [exercise.name, exercise.description ?? "", exercise.engine, ...exercise.tags, ...exercise.categories].join(" ");
}

function matchesArea(exercise: AdaptiveExerciseCandidate, area: CoachArea) {
  return areaPatterns[area].test(words(exercise));
}

function confidenceFor(samples: number) {
  return Math.round(clamp(samples / 30, 0, 1) * 100);
}

function difficultyFor(profile: CoachPlayerProfile, area: CoachArea) {
  const metric = profile.areas.find((item) => item.key === area);
  if (!metric) return 4;
  const base = metric.value >= 80 ? 8 : metric.value >= 65 ? 7 : metric.value >= 50 ? 6 : metric.value >= 35 ? 5 : 4;
  const trendAdjustment = metric.trend >= 8 ? 1 : metric.trend <= -8 ? -1 : 0;
  return clamp(base + trendAdjustment, 2, 9);
}

function workloadFor(activeDaysLast7: number, resultsLast7: number) {
  if (activeDaysLast7 >= 5 || resultsLast7 >= 180) return "RECOVERY" as const;
  if (activeDaysLast7 >= 3 || resultsLast7 >= 90) return "NORMAL" as const;
  return "INTENSIVE" as const;
}

function targetConfiguration(area: CoachArea, difficulty: number): Record<string, unknown> {
  if (area === "CHECKOUT") {
    if (difficulty <= 4) return { targetRange: "40-60", dartsPerTarget: 6 };
    if (difficulty <= 6) return { targetRange: "61-90", dartsPerTarget: 6 };
    if (difficulty <= 8) return { targetRange: "91-120", dartsPerTarget: 9 };
    return { targetRange: "121-170", dartsPerTarget: 9 };
  }
  if (area === "DOUBLES") {
    return { mode: difficulty <= 5 ? "preferred-doubles" : difficulty <= 7 ? "all-doubles" : "pressure-doubles" };
  }
  if (area === "SCORING") {
    return { target: difficulty <= 4 ? "S20" : difficulty <= 7 ? "T20/T19 switch" : "random trebles", visitGoal: difficulty * 10 };
  }
  if (area === "BULL") return { target: difficulty <= 5 ? "SBULL" : "BULL", pressureMode: difficulty >= 8 };
  return { mode: difficulty >= 7 ? "random" : "controlled" };
}

function scoreCandidate(
  exercise: AdaptiveExerciseCandidate,
  area: CoachArea,
  targetDifficulty: number,
  recentExerciseIds: Set<number>,
  workload: AdaptiveSession["workload"],
) {
  let score = matchesArea(exercise, area) ? 100 : 0;
  score -= Math.abs(exercise.difficulty - targetDifficulty) * 9;
  if (recentExerciseIds.has(exercise.id)) score -= 35;
  if (exercise.favorite) score += 8;
  if (workload === "RECOVERY") score -= Math.max(0, exercise.intensity - 4) * 8;
  if (workload === "INTENSIVE") score += Math.max(0, exercise.intensity - 5) * 3;
  return score;
}

function chooseExercise(
  exercises: AdaptiveExerciseCandidate[],
  area: CoachArea,
  difficulty: number,
  recentExerciseIds: Set<number>,
  used: Set<number>,
  workload: AdaptiveSession["workload"],
) {
  return [...exercises]
    .filter((exercise) => !used.has(exercise.id))
    .map((exercise) => ({ exercise, score: scoreCandidate(exercise, area, difficulty, recentExerciseIds, workload) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.defaultMinutes - b.exercise.defaultMinutes)[0]?.exercise ?? null;
}

export function buildAdaptiveSession(input: {
  profile: CoachPlayerProfile;
  exercises: AdaptiveExerciseCandidate[];
  durationMin: number;
  activeDaysLast7: number;
  resultsLast7: number;
  recentExerciseIds?: number[];
}): AdaptiveSession {
  const durationMin = clamp(Math.round(input.durationMin), 30, 180);
  const workload = workloadFor(input.activeDaysLast7, input.resultsLast7);
  const recentExerciseIds = new Set(input.recentExerciseIds ?? []);
  const used = new Set<number>();
  const eligibleWeaknesses = input.profile.weakest.filter((area) => area.samples > 0);
  const focusAreas = (eligibleWeaknesses.length ? eligibleWeaknesses : input.profile.areas)
    .filter((area) => !["TRAINING", "CONSISTENCY"].includes(area.key))
    .slice(0, 3)
    .map((area) => area.key);

  if (!focusAreas.length) focusAreas.push("SCORING", "DOUBLES");

  const warmupMin = durationMin >= 60 ? 10 : 5;
  const cooldownMin = durationMin >= 90 ? 10 : 5;
  const available = durationMin - warmupMin - cooldownMin;
  const focusDurations = focusAreas.map((_, index) => {
    const weights = focusAreas.length === 1 ? [1] : focusAreas.length === 2 ? [0.58, 0.42] : [0.45, 0.33, 0.22];
    return Math.max(10, Math.round(available * (weights[index] ?? 0.2)));
  });
  const durationDifference = available - focusDurations.reduce((sum, value) => sum + value, 0);
  focusDurations[0] = Math.max(10, focusDurations[0] + durationDifference);

  const blocks: AdaptiveSessionBlock[] = [];
  const warmup = chooseExercise(input.exercises, "CONSISTENCY", 3, recentExerciseIds, used, "RECOVERY")
    ?? chooseExercise(input.exercises, "SCORING", 3, recentExerciseIds, used, "RECOVERY");
  if (warmup) {
    used.add(warmup.id);
    blocks.push({
      position: blocks.length + 1,
      exerciseId: warmup.id,
      exerciseName: warmup.name,
      durationMin: warmupMin,
      area: "CONSISTENCY",
      difficultyLevel: 3,
      intensityLevel: Math.min(4, warmup.intensity),
      reason: "Kontrollierter Einstieg für Rhythmus und saubere Technik.",
      configuration: { mode: "warmup" },
    });
  }

  focusAreas.forEach((area, index) => {
    const difficulty = difficultyFor(input.profile, area);
    const exercise = chooseExercise(input.exercises, area, difficulty, recentExerciseIds, used, workload);
    if (!exercise) return;
    used.add(exercise.id);
    const metric = input.profile.areas.find((item) => item.key === area);
    blocks.push({
      position: blocks.length + 1,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      durationMin: focusDurations[index],
      area,
      difficultyLevel: difficulty,
      intensityLevel: workload === "RECOVERY" ? Math.min(exercise.intensity, 5) : exercise.intensity,
      reason: `${metric?.label ?? area} ist mit ${metric?.value ?? 0}/100 aktuell ein priorisierter Entwicklungsbereich${metric?.trend && metric.trend < 0 ? ` und fällt um ${Math.abs(metric.trend)} Punkte` : ""}.`,
      configuration: targetConfiguration(area, difficulty),
    });
  });

  const cooldown = chooseExercise(input.exercises, "CONSISTENCY", 3, recentExerciseIds, used, "RECOVERY");
  if (cooldown) {
    blocks.push({
      position: blocks.length + 1,
      exerciseId: cooldown.id,
      exerciseName: cooldown.name,
      durationMin: cooldownMin,
      area: "CONSISTENCY",
      difficultyLevel: 3,
      intensityLevel: Math.min(4, cooldown.intensity),
      reason: "Ruhiger Abschluss zur Stabilisierung der Technik.",
      configuration: { mode: "cooldown" },
    });
  } else if (blocks.length) {
    blocks[blocks.length - 1].durationMin += cooldownMin;
  }

  const sampleCount = input.profile.areas.reduce((sum, area) => sum + area.samples, 0);
  const confidence = confidenceFor(sampleCount);
  const difficultyLevel = blocks.length
    ? Math.round(blocks.reduce((sum, block) => sum + block.difficultyLevel, 0) / blocks.length)
    : 4;

  return {
    durationMin,
    difficultyLevel,
    workload,
    confidence,
    focusAreas,
    blocks,
    explanation: workload === "RECOVERY"
      ? "Die Belastung der letzten sieben Tage ist hoch. Der Plan reduziert Intensität und bevorzugt kontrollierte Übungen."
      : `Der Plan priorisiert ${focusAreas.join(", ")} und vermeidet nach Möglichkeit zuletzt häufig verwendete Übungen.`,
  };
}
