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

function integer(value: unknown, fallback = 0) {
  return Math.trunc(number(value, fallback));
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

function dartCount(raw: Record<string, unknown>, fallback = 3) {
  return Math.max(1, Math.min(9, integer(raw.dartsUsed ?? raw.dartsThrown, fallback)));
}

function catch40Darts(target: unknown): 6 | 9 {
  return integer(target, 40) >= 91 ? 9 : 6;
}

function segmentCounts(raw: Record<string, unknown>, dartsPerVisit = 3) {
  const single = Math.max(0, Math.min(dartsPerVisit, integer(raw.single)));
  const double = Math.max(0, Math.min(dartsPerVisit - single, integer(raw.double)));
  const triple = Math.max(0, Math.min(dartsPerVisit - single - double, integer(raw.triple)));
  return { single, double, triple, hits: single + double + triple };
}

function numericTarget(target: unknown) {
  const label = String(target ?? "").toUpperCase();
  if (label === "BULL" || label === "SBULL") return 25;
  if (label === "DBULL") return 25;
  const parsed = Number(label.replace(/^[DST]/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function targetSegmentScore(target: unknown, single: number, double: number, triple: number) {
  const label = String(target ?? "").toUpperCase();
  if (label === "BULL" || label === "SBULL" || label === "DBULL") return single * 25 + double * 50;
  const value = numericTarget(label);
  if (label.startsWith("D")) return double * value * 2;
  if (label.startsWith("T")) return triple * value * 3;
  if (label === "D") return double;
  if (label === "T") return triple;
  return value * (single + double * 2 + triple * 3);
}

export function detectExerciseKind(exercise: ExerciseDefinition): string {
  const value = text(exercise);
  if (/121\s*(in|mit)?\s*9|121.*9\s*darts|121.*neun/.test(value)) return "GAME_121";
  if (exercise.engine && exercise.engine !== "AUTO" && exercise.engine !== "CUSTOM") return exercise.engine;
  const configured = String(configOf(exercise).engineType ?? "").trim();
  if (configured) return configured;
  if (/catch\s*40|catch40/.test(value)) return "CATCH_40";
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

  if (kind === "BOB27" || kind === "BOB27_CONFIGURED") return { ...common, score: number(engineConfig.startScore, 27), targetIndex: 0, target: "D1", hits: 0 };
  if (kind.startsWith("AROUND_") || kind === "AROUND_SEQUENCE" || kind === "TARGET_SEQUENCE") {
    const fallback = kind === "AROUND_DOUBLES" ? "D1" : kind === "AROUND_TREBLES" ? "T1" : "1";
    return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? fallback), hits: 0 };
  }
  if (kind === "SHANGHAI" || kind === "SHANGHAI_CONFIGURED") return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? 1) };
  if (kind === "JDC_CHALLENGE") return { ...common, score: 0, targetIndex: 0, target: "Bob's 27", phase: "BOB27" };
  if (kind === "CATCH_40") {
    const firstTarget = Math.max(40, Math.min(170, integer(targets[0] ?? engineConfig.target ?? engineConfig.startTarget, 40)));
    return { ...common, score: 0, targetIndex: 0, target: String(firstTarget), attempts: 0, successes: 0, attemptDarts: 0 };
  }
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
  if (["SEGMENT_POINTS", "HALVE_IT", "SWITCH", "BASEBALL", "FIVES", "COUNT_UP"].includes(kind)) return { ...common, score: 0, targetIndex: 0, target: targetLabel(targets[0] ?? engineConfig.target ?? exercise.name), hits: 0 };
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
  const dartsPerVisit = Math.max(1, Math.min(9, integer(config.dartsPerVisit, 3)));

  if (state.kind === "BOB27" || state.kind === "BOB27_CONFIGURED") {
    const hits = Math.max(0, Math.min(3, integer(raw.hits)));
    const index = state.targetIndex ?? 0;
    const doubleValue = index < 20 ? (index + 1) * 2 : 50;
    const mode = String(config.mode ?? "CLASSIC");
    const missPenalty = mode === "EASY" ? 0 : mode === "HARDCORE" ? Math.max(0, 3 - hits) * (index < 20 ? index + 1 : 25) : hits === 0 ? doubleValue : 0;
    const score = (state.score ?? number(config.startScore, 27)) + hits * doubleValue - missPenalty;
    const completed = (mode !== "EASY" && score <= 0) || index >= 20;
    Object.assign(next, { score, hits: (state.hits ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + 3, targetIndex: completed ? index : index + 1, target: completed ? "Fertig" : index + 1 < 20 ? `D${index + 2}` : "DBull", completed });
    return result(exercise, next, { ...visitValue, hits, doubleValue, missPenalty, scoreAfter: score }, score);
  }

  if (state.kind.startsWith("AROUND_") || state.kind === "AROUND_SEQUENCE") {
    const hits = Math.max(0, Math.min(dartsPerVisit, integer(raw.hits)));
    const fallback = Array.from({ length: 21 }, (_, index) => index < 20 ? index + 1 : "BULL");
    const sequence = targets.length ? targets : fallback;
    const targetIndex = (state.targetIndex ?? 0) + (hits > 0 ? 1 : 0);
    const completed = targetIndex >= sequence.length;
    Object.assign(next, { targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, hits: (state.hits ?? 0) + hits, score: (state.score ?? 0) + (hits > 0 ? 1 : 0), dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, hits, advanced: hits > 0, targetAfter: next.target }, hits > 0 ? 1 : 0);
  }

  if (state.kind === "TARGET_SEQUENCE") {
    const { single, double, triple, hits } = segmentCounts(raw, dartsPerVisit);
    const sequence = targets.length ? targets : [state.target];
    const currentTarget = sequence[state.targetIndex ?? 0] ?? state.target;
    const visitScore = targetSegmentScore(currentTarget, single, double, triple);
    const targetIndex = (state.targetIndex ?? 0) + 1;
    const completed = targetIndex >= sequence.length;
    Object.assign(next, { score: (state.score ?? 0) + visitScore, hits: (state.hits ?? 0) + hits, targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, single, double, triple, hits, visitScore }, visitScore);
  }

  if (state.kind === "CATCH_40") {
    const sequence = targets.length ? targets : [config.target ?? config.startTarget ?? state.target ?? 40];
    const currentIndex = state.targetIndex ?? 0;
    const currentTarget = Math.max(40, Math.min(170, integer(sequence[currentIndex] ?? state.target, 40)));
    const dartsAllowed = catch40Darts(currentTarget);
    const maxScore = dartsAllowed * 60;
    const scored = Math.max(0, Math.min(maxScore, integer(raw.score ?? raw.value)));
    const rawRemaining = currentTarget - scored;
    const bust = rawRemaining < 0;
    const remaining = bust ? currentTarget : rawRemaining;
    const checkout = !bust && remaining === 0;
    const targetIndex = currentIndex + 1;
    const completed = targetIndex >= sequence.length;
    const nextTarget = completed ? "Fertig" : targetLabel(sequence[targetIndex]);
    Object.assign(next, {
      score: scored,
      targetIndex,
      target: nextTarget,
      attempts: (state.attempts ?? 0) + 1,
      successes: (state.successes ?? 0) + (checkout ? 1 : 0),
      attemptDarts: 0,
      dartsThrown: (state.dartsThrown ?? 0) + dartsAllowed,
      completed,
    });
    return result(exercise, next, {
      ...visitValue,
      score: scored,
      scored,
      target: currentTarget,
      dartsAllowed,
      remaining,
      checkout,
      bust,
      reachedTarget: checkout,
      targetAfter: nextTarget,
    }, scored);
  }

  if (state.kind === "GAME_121") {
    const currentTarget = Math.max(2, number(state.target, number(config.startTarget, 121)));
    const baseTarget = Math.max(2, state.baseTarget ?? currentTarget);
    const before = state.score ?? currentTarget;
    const scored = Math.max(0, Math.min(180, integer(raw.score ?? raw.value)));
    const dartsUsed = dartCount(raw, 3);
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
    const scored = Math.max(0, Math.min(180, integer(raw.score ?? raw.value)));
    const before = state.score ?? number(config.startScore, 501);
    const inRule = String(config.inRule ?? "SINGLE");
    const outRule = String(config.outRule ?? "DOUBLE");
    const opened = Boolean(state.opened) || inRule !== "DOUBLE" || bool(raw.doubleIn);
    const checkoutType = String(raw.checkoutType ?? (bool(raw.checkout) ? "DOUBLE" : "NONE"));
    const validOut = outRule === "SINGLE" ? checkoutType === "SINGLE" : outRule === "MASTER" ? ["DOUBLE", "TREBLE"].includes(checkoutType) : checkoutType === "DOUBLE";
    const remaining = opened ? before - scored : before;
    const impossibleRest = (outRule === "DOUBLE" || outRule === "MASTER") && remaining === 1;
    const bust = opened && (remaining < 0 || impossibleRest || (remaining === 0 && !validOut));
    const score = bust ? before : remaining;
    const completed = opened && score === 0 && validOut;
    Object.assign(next, { score, target: String(score), opened, completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, scored, bust, remaining: score, checkoutType, opened, validOut }, scored);
  }

  if (["SHANGHAI", "SHANGHAI_CONFIGURED"].includes(state.kind)) {
    const { single, double, triple, hits } = segmentCounts(raw, dartsPerVisit);
    const sequence = targets.length ? targets : [1, 2, 3, 4, 5, 6, 7];
    const currentTarget = sequence[state.targetIndex ?? 0] ?? state.target;
    const roundScore = targetSegmentScore(currentTarget, single, double, triple);
    const shanghai = String(currentTarget).toUpperCase() !== "BULL" && single > 0 && double > 0 && triple > 0;
    const targetIndex = (state.targetIndex ?? 0) + 1;
    const completed = (bool(config.instantShanghai) && shanghai) || targetIndex >= sequence.length;
    Object.assign(next, { score: (state.score ?? 0) + roundScore, hits: (state.hits ?? 0) + hits, targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, single, double, triple, roundScore, shanghai }, roundScore);
  }

  if (["CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"].includes(state.kind)) {
    const checkout = bool(raw.checkout);
    const dartsUsed = dartCount(raw, 3);
    const sequence = targets.length ? targets : [config.target ?? state.target];
    const currentIndex = state.targetIndex ?? 0;
    const maxDarts = number(config.maxDarts, 6);
    const attemptDarts = (state.attemptDarts ?? 0) + dartsUsed;
    const scoring = config.scoring && typeof config.scoring === "object" && !Array.isArray(config.scoring) ? config.scoring as Record<string, unknown> : {};
    let points = 0;
    if (checkout) {
      if (dartsUsed <= 2) points = number(scoring.two, 3);
      else if (dartsUsed === 3) points = number(scoring.three, state.kind === "CHECKOUT_RANGE" ? 2 : 1);
      else points = number(scoring.six, 1);
    }
    const moveNext = checkout || attemptDarts >= maxDarts;
    const attemptNumber = (state.attempts ?? 0) + (moveNext ? 1 : 0);
    const configuredRounds = Math.max(1, integer(config.rounds, 1));
    const sequenceFinished = state.kind === "CHECKOUT_RANGE" && currentIndex + (moveNext ? 1 : 0) >= sequence.length;
    const fixedFinished = state.kind === "FIXED_CHECKOUT" && moveNext && attemptNumber >= configuredRounds;
    const targetIndex = moveNext && state.kind === "CHECKOUT_RANGE" ? currentIndex + 1 : currentIndex;
    const completed = sequenceFinished || fixedFinished;
    const nextTarget = state.kind === "RANDOM_CHECKOUT" && moveNext
      ? Math.floor(Math.random() * (number(config.max, 170) - number(config.min, 2) + 1)) + number(config.min, 2)
      : sequence[targetIndex] ?? state.target;
    Object.assign(next, { score: (state.score ?? 0) + points, targetIndex, target: completed ? "Fertig" : targetLabel(nextTarget), attemptDarts: moveNext ? 0 : attemptDarts, attempts: attemptNumber, successes: (state.successes ?? 0) + (checkout ? 1 : 0), dartsThrown: (state.dartsThrown ?? 0) + dartsUsed, completed });
    return result(exercise, next, { ...visitValue, checkout, dartsUsed, points, attemptDarts, attemptNumber }, points);
  }

  if (state.kind === "SEGMENT_POINTS") {
    const { single, double, triple, hits } = segmentCounts(raw, dartsPerVisit);
    const target = config.target ?? state.target;
    const points = bool(config.bull) ? single + double * 2 : single + double * 2 + triple * 3;
    Object.assign(next, { score: (state.score ?? 0) + points, hits: (state.hits ?? 0) + hits, target: targetLabel(target), dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, single, double, triple, hits, points }, points);
  }

  if (["HALVE_IT", "BASEBALL"].includes(state.kind)) {
    const { single, double, triple, hits } = segmentCounts(raw, dartsPerVisit);
    const sequence = targets.length ? targets : [state.target];
    const currentTarget = sequence[state.targetIndex ?? 0] ?? state.target;
    const visitScore = state.kind === "BASEBALL" ? single + double * 2 + triple * 3 : targetSegmentScore(currentTarget, single, double, triple);
    const missed = hits === 0;
    let score = (state.score ?? 0) + visitScore;
    if (state.kind === "HALVE_IT" && missed) score = String(config.missPenalty ?? "HALVE") === "RESET" ? 0 : Math.floor((state.score ?? 0) / 2);
    const targetIndex = (state.targetIndex ?? 0) + 1;
    const completed = targetIndex >= sequence.length;
    Object.assign(next, { score, hits: (state.hits ?? 0) + hits, targetIndex, target: completed ? "Fertig" : targetLabel(sequence[targetIndex]), completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, single, double, triple, hits, visitScore, missed }, visitScore);
  }

  if (state.kind === "SWITCH") {
    const { single, double, triple, hits } = segmentCounts(raw, dartsPerVisit);
    const points = single + double * 2 + triple * 3;
    Object.assign(next, { score: (state.score ?? 0) + points, hits: (state.hits ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit, target: state.visit % 2 === 1 ? `${targetLabel(targets[1])} / ${targetLabel(targets[0])}` : `${targetLabel(targets[0])} / ${targetLabel(targets[1])}` });
    return result(exercise, next, { ...visitValue, single, double, triple, hits, points }, points);
  }

  if (state.kind === "FIVES") {
    const scored = Math.max(0, Math.min(180, integer(raw.score ?? raw.value)));
    const points = scored % 5 === 0 ? scored / 5 : 0;
    Object.assign(next, { score: (state.score ?? 0) + points, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit, completed: bool(raw.finish) });
    return result(exercise, next, { ...visitValue, scored, points }, points);
  }

  if (state.kind === "CRICKET") {
    const target = String(raw.target ?? state.target ?? "20");
    const marksAdded = Math.max(0, Math.min(3, integer(raw.marks ?? raw.hits)));
    const marks = { ...(state.marks ?? {}) };
    const previousMarks = marks[target] ?? 0;
    const overflowMarks = Math.max(0, previousMarks + marksAdded - 3);
    marks[target] = Math.min(3, previousMarks + marksAdded);
    const variant = String(config.variant ?? "STANDARD");
    const targetValue = target.toUpperCase() === "BULL" ? 25 : number(target, 0);
    const manualPoints = Math.max(0, integer(raw.points));
    const scoredPoints = variant === "NO_SCORE" ? 0 : manualPoints || overflowMarks * targetValue;
    const allClosed = Object.values(marks).every((value) => value >= 3);
    const score = (state.score ?? 0) + scoredPoints;
    const completed = bool(raw.finish) || (variant === "NO_SCORE" && allClosed) || (variant === "RACE_200" && score >= 200);
    Object.assign(next, { marks, score, target, completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, target, marksAdded, overflowMarks, scoredPoints, marks }, scoredPoints);
  }

  if (state.kind === "KILLER") {
    const livesDelta = integer(raw.livesDelta);
    const lives = Math.max(0, (state.lives ?? number(config.startLives, 3)) + livesDelta);
    const phase = bool(raw.killer) ? "KILLER" : state.phase;
    const completed = lives <= 0 || bool(raw.finish);
    Object.assign(next, { lives, phase, completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, livesDelta, lives, phase }, lives);
  }

  if (state.kind === "COUNT_UP") {
    const scored = Math.max(0, Math.min(180, integer(raw.score ?? raw.value)));
    const target = number(config.target, 301);
    const total = (state.score ?? 0) + scored;
    const bust = total > target;
    const score = bust ? state.score ?? 0 : total;
    const completed = score === target || bool(raw.finish);
    Object.assign(next, { score, completed, dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, scored, bust, score }, scored);
  }

  if (state.kind === "TIC_TAC_TOE") {
    const target = String(raw.target ?? "");
    const marks = { ...(state.marks ?? {}) };
    if (target && marks[target] == null) marks[target] = 1;
    const gridTargets = targets.map(String);
    const occupied = new Set(Object.keys(marks));
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const won = lines.some((line) => line.every((index) => occupied.has(gridTargets[index])));
    Object.assign(next, { marks, score: Object.keys(marks).length, completed: won || bool(raw.finish), dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit });
    return result(exercise, next, { ...visitValue, target, marks, won }, target ? 1 : 0);
  }

  const hits = raw.hits == null ? undefined : Math.max(0, Math.min(dartsPerVisit, integer(raw.hits)));
  const score = number(raw.score ?? raw.value ?? hits);
  const finish = bool(raw.finish);
  Object.assign(next, { score: (state.score ?? 0) + score, hits: (state.hits ?? 0) + (hits ?? 0), dartsThrown: (state.dartsThrown ?? 0) + dartsPerVisit, attempts: (state.attempts ?? 0) + 1, completed: finish });
  return result(exercise, next, { ...visitValue, score, hits, finish }, score);
}
