export type ExerciseDefinition = {
  name: string;
  description?: string | null;
  resultType: string;
  engine?: string | null;
  completionMode?: string | null;
  completionValue?: number | null;
  resultConfigJson?: unknown;
};

export type PlayerExerciseState = {
  kind: string;
  visit: number;
  completed: boolean;
  score?: number;
  targetIndex?: number;
  target?: string;
  dartsThrown?: number;
  hits?: number;
  attempts?: number;
  successes?: number;
  startedAt?: number;
  deadlineAt?: number;
  completionMode?: string;
  completionValue?: number;
  baseTarget?: number;
  attemptDarts?: number;
  highestTarget?: number;
  firstVisitFinishes?: number;
  engineConfig?: Record<string, unknown>;
  marks?: Record<string, number>;
  lives?: number;
  opened?: boolean;
  phase?: string;
};

function configOf(exercise: ExerciseDefinition): Record<string, unknown> {
  return exercise.resultConfigJson && typeof exercise.resultConfigJson === "object" && !Array.isArray(exercise.resultConfigJson)
    ? exercise.resultConfigJson as Record<string, unknown>
    : {};
}

function text(exercise: ExerciseDefinition) {
  return `${exercise.name} ${exercise.description ?? ""}`.toLowerCase();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function targetLabel(value: unknown) {
  return value == null ? "–" : String(value);
}

export function detectExerciseKind(exercise: ExerciseDefinition): string {
  const configured = String(configOf(exercise).engineType ?? "").trim();
  if (configured) return configured;
  const value = text(exercise);
  if (/121\s*(in|mit)?\s*9|121.*9\s*darts|121.*neun/.test(value)) return "GAME_121";
  if (exercise.engine && exercise.engine !== "AUTO" && exercise.engine !== "CUSTOM") return exercise.engine;
  if (/bob.?s?\s*27|bob27/.test(value)) return "BOB27";
  if (/around the clock|around the world|rund um die uhr/.test(value)) return /doppel|double/.test(value) ? "AROUND_DOUBLES" : /triple|treble/.test(value) ? "AROUND_TREBLES" : "AROUND_CLOCK";
  if (/shanghai/.test(value)) return "SHANGHAI";
  if (/jdc challenge/.test(value)) return "JDC_CHALLENGE";
  if (/501|301|701|x01/.test(value)) return "X01";
  if (/checkout|finish|check out|stellen/.test(value)) return "CHECKOUT_RANGE";
  if (/scoring|high score|60 darts|100 darts|aufnahme/.test(value) || exercise.resultType === "SCORE_0_TO_180") return "SCORING";
  if (/doppel|double/.test(value) && exercise.resultType === "HITS_0_TO_3") return "DOUBLES_ROUNDS";
  if (/bull/.test(value) && exercise.resultType === "HITS_0_TO_3") return "BULL_ROUNDS";
  if (exercise.resultType === "HITS_0_TO_3") return "HIT_ROUNDS";
  if (exercise.resultType === "TIME_BASED") return "TIME_BASED";
  return "CUSTOM";
}

function configuredState(exercise: ExerciseDefinition) {
  const completionMode = exercise.completionMode ?? "ENGINE_DEFAULT";
  const completionValue = exercise.completionValue ?? undefined;
  const state: Pick<PlayerExerciseState, "completionMode" | "completionValue" | "startedAt" | "deadlineAt"> = { completionMode, completionValue };
  if (completionMode === "TIME_LIMIT" && completionValue && completionValue > 0) {
    state.startedAt = Date.now();
    state.deadlineAt = state.startedAt + completionValue * 60_000;
  }
  return state;
}

export function createInitialExerciseState(exercise: ExerciseDefinition): PlayerExerciseState {
  const kind = detectExerciseKind(exercise);
  const engineConfig = configOf(exercise);
  const common = { kind, visit: 1, completed: false, dartsThrown: 0, engineConfig, ...configuredState(exercise) };
  const targets = list(engineConfig.targets ?? engineConfig.sequence);

  if (kind === "BOB27" || kind === "BOB27_CONFIGURED") {
    const startScore = number(engineConfig.startScore, 27);
    return { ...common, score: startScore, targetIndex: 0, target: "D1", hits: 0 };
  }
  if (kind.startsWith("AROUND_") || kind === "TARGET_SEQUENCE") {
    const fallback = kind === "AROUND_DOUBLES" ? "D1" : kind === "AROUND_TREBLES" ? "T1" : "1";
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? fallback), hits: 0 };
  }
  if (kind === "SHANGHAI" || kind === "SHANGHAI_CONFIGURED") {
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? 1) };
  }
  if (kind === "JDC_CHALLENGE") return { ...common, score: 0, targetIndex: 0, target: "Bob's 27", phase: "BOB27" };
  if (kind === "GAME_121") {
    const startTarget = number(engineConfig.startTarget, 121);
    return { ...common, score: startTarget, target: String(startTarget), baseTarget: startTarget, attemptDarts: 0, attempts: 0, successes: 0, highestTarget: startTarget, firstVisitFinishes: 0 };
  }
  if (kind === "X01" || kind === "X01_CONFIGURED") {
    const startScore = number(engineConfig.startScore, text(exercise).includes("301") ? 301 : text(exercise).includes("701") ? 701 : 501);
    return { ...common, score: startScore, target: String(startScore), opened: String(engineConfig.inRule ?? "SINGLE") !== "DOUBLE" };
  }
  if (["CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"].includes(kind)) {
    const checkoutTargets = targets.length ? targets : [engineConfig.target ?? 61];
    const randomTarget = kind === "RANDOM_CHECKOUT" ? Math.floor(Math.random() * (number(engineConfig.max, 170) - number(engineConfig.min, 2) + 1)) + number(engineConfig.min, 2) : checkoutTargets[0];
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(randomTarget), attempts: 0, successes: 0, attemptDarts: 0 };
  }
  if (["SEGMENT_POINTS", "HALVE_IT", "SWITCH", "BASEBALL", "FIVES", "COUNT_UP"].includes(kind)) {
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? engineConfig.target ?? exercise.name), hits: 0 };
  }
  if (kind === "CRICKET") {
    const cricketTargets = targets.length ? targets : [15, 16, 17, 18, 19, 20, "BULL"];
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(cricketTargets[0]), marks: Object.fromEntries(cricketTargets.map((target) => [String(target), 0])) };
  }
  if (kind === "KILLER") return { ...common, score: 0, lives: number(engineConfig.startLives, 3), phase: "QUALIFY", target: "Eigene Zahl" };
  if (kind === "TIC_TAC_TOE") return { ...common, score: 0, marks: {}, target: "Freies Feld" };
  return { ...common, score: 0, hits: 0, attempts: 0, successes: 0, target: targetLabel(engineConfig.target ?? exercise.name) };
}

function withConfiguredCompletion(exercise: ExerciseDefinition, state: PlayerExerciseState, forceTimeout = false) {
  const mode = state.completionMode ?? exercise.completionMode ?? "ENGINE_DEFAULT";
  const value = state.completionValue ?? exercise.completionValue ?? 0;
  if (mode === "VISIT_LIMIT" && value > 0 && state.visit > value) return { ...state, completed: true };
  if (mode === "DART_LIMIT" && value > 0 && (state.dartsThrown ?? 0) >= value) return { ...state, completed: true };
  if (mode === "TIME_LIMIT" && value > 0 && (forceTimeout || (state.deadlineAt != null && Date.now() >= state.deadlineAt))) return { ...state, completed: true };
  return state;
}

function result(exercise: ExerciseDefinition, state: PlayerExerciseState, visitValue: Record<string, unknown>, calculatedScore: number | null) {
  const finalState = withConfiguredCompletion(exercise, state);
  return { nextState: finalState, visitValue, calculatedScore, playerFinished: finalState.completed };
}

export function applyVisit(exercise: ExerciseDefinition, state: PlayerExerciseState, raw: Record<string, unknown>) {
  const next: PlayerExerciseState = { ...state, visit: state.visit + 1 };
  const visitValue: Record<string, unknown> = { ...raw, visit: state.visit, target: state.target, stateBefore: state };
  if (bool(raw.timedOut)) return result(exercise, withConfiguredCompletion(exercise, next, true), { ...visitValue, timedOut: true }, null);
  const config = state.engineConfig ?? configOf(exercise);
  const targets = list(config.targets ?? config.sequence);

  if (state.kind === "BOB27" || state.kind === "BOB27_CONFIGURED") {
    const hits = Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
    const index = state.targetIndex ?? 0;
    const doubleValue = index < 20 ? (index + 1) * 2 : 50;
    const mode = String(config.mode ?? "CLASSIC");
    const missPenalty = mode === "EASY" ? 0 : mode === "HARDCORE" ? Math.max(0, 3 - hits) * (index < 20 ? index + 1 : 25) : hits === 0 ? doubleValue : 0;
    const score = (state.score ?? number(config.startScore, 27)) + hits * doubleValue - missPenalty;
    const finishedByScore = mode !== "EASY" && score <= 0;
    const completed = finishedByScore || index >= 20;
    Object.assign(next, { score, hits: (state.hits ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + 3, targetIndex: completed ? index : index + 1, target: completed ? "Fertig" : index + 1 < 20 ? `D${index + 2}` : "DBull", completed });
    return result(exercise, next, { ...visitValue, hits, doubleValue, missPenalty, scoreAfter: score }, score);
  }

  if (state.kind.startsWith("AROUND_") || state.kind === "TARGET_SEQUENCE") {
    const hits = Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
    const fallbackCount = state.kind === "AROUND_TREBLES" ? 20 : 21;
    const sequence = targets.length ? targets : Array.from({ length: fallbackCount }, (_, index) => index < 20 ? `${state.kind === "AROUND_DOUBLES" ? "D" : state.kind === "AROUND_TREBLES" ? "T" : ""}${index + 1}` : "BULL");
    const advance = hits > 0 ? Math.max(1, Math.min(hits, sequence.length - (state.targetIndex ?? 0))) : 0;
    const targetIndex = (state.targetIndex ?? 0) + advance;
    const completed = targetIndex >= sequence.length;
    Object.assign(next, { targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, hits: (state.hits ?? 0) + hits, score: (state.score ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, hits, targetAfter: next.target }, targetIndex);
  }

  if (state.kind === "GAME_121") {
    const currentTarget = Math.max(2, number(state.target, number(config.startTarget, 121)));
    const baseTarget = Math.max(2, state.baseTarget ?? currentTarget);
    const before = state.score ?? currentTarget;
    const scored = Math.max(0, Math.min(180, Math.trunc(number(raw.score ?? raw.value))));
    const dartsUsed = Math.max(1, Math.min(3, Math.trunc(number(raw.dartsUsed, 3))));
    const checkout = bool(raw.checkout);
    const calculatedRemaining = before - scored;
    const bust = calculatedRemaining < 0 || calculatedRemaining === 1 || (calculatedRemaining === 0 && !checkout);
    const remaining = bust ? before : calculatedRemaining;
    const attemptDarts = (state.attemptDarts ?? 0) + dartsUsed;
    const totalDarts = (state.dartsThrown ?? 0) + dartsUsed;
    if (remaining === 0 && checkout) {
      const nextTarget = currentTarget + 1;
      const maxTarget = number(config.maxTarget, 170);
      const completed = currentTarget >= maxTarget;
      const firstVisit = attemptDarts <= 3;
      Object.assign(next, { score: completed ? 0 : nextTarget, target: completed ? `${maxTarget} geschafft` : String(nextTarget), baseTarget: firstVisit ? nextTarget : baseTarget, attemptDarts: 0, dartsThrown: totalDarts, attempts: (state.attempts ?? 0) + 1, successes: (state.successes ?? 0) + 1, highestTarget: Math.max(state.highestTarget ?? currentTarget, currentTarget), firstVisitFinishes: (state.firstVisitFinishes ?? 0) + (firstVisit ? 1 : 0), completed });
      return result(exercise, next, { ...visitValue, scored, dartsUsed, checkout, targetCompleted: currentTarget }, currentTarget);
    }
    if (attemptDarts >= number(config.dartsPerAttempt, 9)) Object.assign(next, { score: baseTarget, target: String(baseTarget), attemptDarts: 0, attempts: (state.attempts ?? 0) + 1, dartsThrown: totalDarts });
    else Object.assign(next, { score: remaining, attemptDarts, dartsThrown: totalDarts });
    return result(exercise, next, { ...visitValue, scored, dartsUsed, checkout, bust, remaining }, scored);
  }

  if (state.kind === "X01" || state.kind === "X01_CONFIGURED") {
    const scored = Math.max(0, Math.min(180, Math.trunc(number(raw.score ?? raw.value))));
    const before = state.score ?? number(config.startScore, 501);
    const inRule = String(config.inRule ?? "SINGLE");
    const outRule = String(config.outRule ?? "DOUBLE");
    const opened = state.opened || inRule !== "DOUBLE" || bool(raw.doubleIn);
    const checkoutType = String(raw.checkoutType ?? (bool(raw.checkout) ? "DOUBLE" : "NONE"));
    const validOut = outRule === "SINGLE" ? checkoutType !== "NONE" || bool(raw.checkout) : outRule === "MASTER" ? ["DOUBLE", "TREBLE"].includes(checkoutType) : checkoutType === "DOUBLE" || bool(raw.checkout);
    const remaining = opened ? before - scored : before;
    const bust = opened && (remaining < 0 || (outRule === "DOUBLE" && remaining === 1) || (remaining === 0 && !validOut));
    const score = bust ? before : remaining;
    const completed = opened && score === 0 && validOut;
    Object.assign(next, { score, target: String(score), opened, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, scored, bust, remaining: score, checkoutType, opened }, scored);
  }

  if (["SHANGHAI", "SHANGHAI_CONFIGURED"].includes(state.kind)) {
    const single = Math.max(0, Math.min(3, Math.trunc(number(raw.single))));
    const double = Math.max(0, Math.min(3, Math.trunc(number(raw.double))));
    const triple = Math.max(0, Math.min(3, Math.trunc(number(raw.triple))));
    const targetNumber = number(state.target, 0);
    const roundScore = targetNumber * (single + double * 2 + triple * 3);
    const shanghai = single > 0 && double > 0 && triple > 0;
    const sequence = targets.length ? targets : [1, 2, 3, 4, 5, 6, 7];
    const targetIndex = (state.targetIndex ?? 0) + 1;
    const completed = (bool(config.instantShanghai) && shanghai) || targetIndex >= sequence.length;
    Object.assign(next, { score: (state.score ?? 0) + roundScore, targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, single, double, triple, roundScore, shanghai }, roundScore);
  }

  if (["CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"].includes(state.kind)) {
    const checkout = bool(raw.checkout);
    const dartsUsed = Math.max(1, Math.trunc(number(raw.dartsUsed, 3)));
    const sequence = targets.length ? targets : [config.target ?? state.target];
    const currentIndex = state.targetIndex ?? 0;
    const maxDarts = number(config.maxDarts, 6);
    const attemptDarts = (state.attemptDarts ?? 0) + dartsUsed;
    let points = 0;
    if (checkout) points = dartsUsed <= 2 ? 3 : dartsUsed <= 3 ? 2 : 1;
    const moveNext = checkout || attemptDarts >= maxDarts;
    const targetIndex = moveNext ? currentIndex + 1 : currentIndex;
    const completed = targetIndex >= sequence.length || (state.kind === "FIXED_CHECKOUT" && moveNext && number(config.rounds, 1) <= (state.attempts ?? 0) + 1);
    const nextTarget = state.kind === "RANDOM_CHECKOUT" && moveNext ? Math.floor(Math.random() * (number(config.max, 170) - number(config.min, 2) + 1)) + number(config.min, 2) : sequence[targetIndex] ?? state.target;
    Object.assign(next, { score: (state.score ?? 0) + points, targetIndex, target: completed ? "Fertig" : targetLabel(nextTarget), attemptDarts: moveNext ? 0 : attemptDarts, attempts: (state.attempts ?? 0) + (moveNext ? 1 : 0), successes: (state.successes ?? 0) + (checkout ? 1 : 0), dartsThrown: (state.dartsThrown ?? 0) + dartsUsed, completed });
    return result(exercise, next, { ...visitValue, checkout, dartsUsed, points, attemptDarts }, points);
  }

  if (["SEGMENT_POINTS", "SWITCH", "BASEBALL", "TARGET_SEQUENCE", "HALVE_IT"].includes(state.kind)) {
    const single = Math.max(0, Math.min(3, Math.trunc(number(raw.single))));
    const double = Math.max(0, Math.min(3, Math.trunc(number(raw.double))));
    const triple = Math.max(0, Math.min(3, Math.trunc(number(raw.triple))));
    const hits = Math.max(0, Math.min(3, Math.trunc(number(raw.hits, single + double + triple))));
    const visitScore = number(raw.score, single + double * 2 + triple * 3 || hits);
    const missed = hits === 0 && visitScore === 0;
    let score = (state.score ?? 0) + visitScore;
    if (state.kind === "HALVE_IT" && missed) score = String(config.missPenalty ?? "HALVE") === "RESET" ? 0 : Math.floor((state.score ?? 0) / 2);
    const sequence = targets.length ? targets : [config.target ?? state.target];
    const targetIndex = Math.min(sequence.length, (state.targetIndex ?? 0) + 1);
    const completed = targetIndex >= sequence.length;
    Object.assign(next, { score, hits: (state.hits ?? 0) + hits, targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, single, double, triple, hits, visitScore, missed }, visitScore);
  }

  if (state.kind === "FIVES") {
    const scored = Math.max(0, Math.min(180, Math.trunc(number(raw.score ?? raw.value))));
    const points = scored % 5 === 0 ? scored / 5 : 0;
    Object.assign(next, { score: (state.score ?? 0) + points, dartsThrown: (state.dartsThrown ?? 0) + 3, completed: bool(raw.finish) });
    return result(exercise, next, { ...visitValue, scored, points }, points);
  }

  if (state.kind === "CRICKET") {
    const target = String(raw.target ?? state.target ?? "20");
    const marksAdded = Math.max(0, Math.min(3, Math.trunc(number(raw.marks ?? raw.hits))));
    const marks = { ...(state.marks ?? {}) };
    marks[target] = Math.min(3, (marks[target] ?? 0) + marksAdded);
    const completed = Object.values(marks).every((value) => value >= 3) || bool(raw.finish);
    Object.assign(next, { marks, score: (state.score ?? 0) + number(raw.points), target, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, target, marksAdded, marks }, marksAdded);
  }

  if (state.kind === "KILLER") {
    const livesDelta = Math.trunc(number(raw.livesDelta));
    const lives = Math.max(0, (state.lives ?? number(config.startLives, 3)) + livesDelta);
    const phase = bool(raw.killer) ? "KILLER" : state.phase;
    const completed = lives <= 0 || bool(raw.finish);
    Object.assign(next, { lives, phase, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, livesDelta, lives, phase }, lives);
  }

  if (state.kind === "COUNT_UP") {
    const scored = Math.max(0, Math.min(180, Math.trunc(number(raw.score ?? raw.value))));
    const target = number(config.target, 301);
    const total = (state.score ?? 0) + scored;
    const bust = total > target;
    const score = bust ? state.score ?? 0 : total;
    const completed = score === target || bool(raw.finish);
    Object.assign(next, { score, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, scored, bust, score }, scored);
  }

  if (state.kind === "TIC_TAC_TOE") {
    const target = String(raw.target ?? "");
    const marks = { ...(state.marks ?? {}) };
    if (target) marks[target] = 1;
    Object.assign(next, { marks, score: Object.keys(marks).length, completed: bool(raw.finish), dartsThrown: (state.dartsThrown ?? 0) + 3 });
    return result(exercise, next, { ...visitValue, target, marks }, target ? 1 : 0);
  }

  const hits = raw.hits == null ? undefined : Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
  const score = number(raw.score ?? raw.value ?? hits);
  const finish = bool(raw.finish);
  Object.assign(next, { score: (state.score ?? 0) + score, hits: (state.hits ?? 0) + (hits ?? 0), dartsThrown: (state.dartsThrown ?? 0) + 3, attempts: (state.attempts ?? 0) + 1, completed: finish });
  return result(exercise, next, { ...visitValue, score, hits, finish }, score);
}
