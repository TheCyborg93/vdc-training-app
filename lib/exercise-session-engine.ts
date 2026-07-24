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
};

function text(exercise: ExerciseDefinition) {
  return `${exercise.name} ${exercise.description ?? ""}`.toLowerCase();
}

export function detectExerciseKind(exercise: ExerciseDefinition): string {
  if (exercise.engine && exercise.engine !== "AUTO") return exercise.engine;
  const value = text(exercise);
  if (/bob.?s?\s*27|bob27/.test(value)) return "BOB27";
  if (/around the clock|around the world|rund um die uhr|1\s*[-–]\s*20/.test(value)) {
    if (/doppel|double/.test(value)) return "AROUND_DOUBLES";
    if (/triple|treble/.test(value)) return "AROUND_TREBLES";
    return "AROUND_CLOCK";
  }
  if (/shanghai/.test(value)) return "SHANGHAI";
  if (/jdc challenge/.test(value)) return "JDC_CHALLENGE";
  if (/121|120|170|finish.*leiter|checkout.*leiter/.test(value)) return "CHECKOUT_LADDER";
  if (/checkout|finish|check out|stellen/.test(value)) return "CHECKOUT_LADDER";
  if (/501|301|x01/.test(value)) return "X01";
  if (/scoring|high score|60 darts|100 darts|aufnahme/.test(value) || exercise.resultType === "SCORE_0_TO_180") return "SCORING";
  if (/doppel|double/.test(value) && exercise.resultType === "HITS_0_TO_3") return "DOUBLES_ROUNDS";
  if (/bull/.test(value) && exercise.resultType === "HITS_0_TO_3") return "BULL_ROUNDS";
  if (exercise.resultType === "HITS_0_TO_3") return "HIT_ROUNDS";
  if (exercise.resultType === "TIME_BASED") return "TIME_BASED";
  return "CUSTOM";
}

function configuredTimeState(exercise: ExerciseDefinition) {
  if (exercise.completionMode !== "TIME_LIMIT" || !exercise.completionValue || exercise.completionValue <= 0) return {};
  const startedAt = Date.now();
  return { startedAt, deadlineAt: startedAt + exercise.completionValue * 60_000 };
}

export function createInitialExerciseState(exercise: ExerciseDefinition): PlayerExerciseState {
  const kind = detectExerciseKind(exercise);
  const timeState = configuredTimeState(exercise);
  if (kind === "BOB27") return { kind, visit: 1, completed: false, score: 27, targetIndex: 0, target: "D1", dartsThrown: 0, hits: 0, ...timeState };
  if (kind.startsWith("AROUND_")) return { kind, visit: 1, completed: false, targetIndex: 0, target: kind === "AROUND_DOUBLES" ? "D1" : kind === "AROUND_TREBLES" ? "T1" : "1", dartsThrown: 0, hits: 0, ...timeState };
  if (kind === "SHANGHAI") return { kind, visit: 1, completed: false, targetIndex: 0, target: "1", score: 0, dartsThrown: 0, ...timeState };
  if (kind === "JDC_CHALLENGE") return { kind, visit: 1, completed: false, targetIndex: 0, target: "10", score: 0, dartsThrown: 0, ...timeState };
  if (kind === "X01") return { kind, visit: 1, completed: false, score: text(exercise).includes("301") ? 301 : 501, dartsThrown: 0, ...timeState };
  return { kind, visit: 1, completed: false, score: 0, dartsThrown: 0, hits: 0, attempts: 0, successes: 0, ...timeState };
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function withConfiguredCompletion(exercise: ExerciseDefinition, state: PlayerExerciseState, forceTimeout = false) {
  const mode = exercise.completionMode ?? "ENGINE_DEFAULT";
  const value = exercise.completionValue ?? 0;
  if (mode === "VISIT_LIMIT" && value > 0 && state.visit > value) return { ...state, completed: true };
  if (mode === "DART_LIMIT" && value > 0 && (state.dartsThrown ?? 0) >= value) return { ...state, completed: true };
  if (mode === "TIME_LIMIT" && value > 0 && (forceTimeout || (state.deadlineAt != null && Date.now() >= state.deadlineAt))) return { ...state, completed: true };
  return state;
}

export function applyVisit(exercise: ExerciseDefinition, state: PlayerExerciseState, raw: Record<string, unknown>) {
  const next = { ...state, visit: state.visit + 1 };
  const visitValue: Record<string, unknown> = { ...raw, visit: state.visit, target: state.target, stateBefore: state };
  const forceTimeout = Boolean(raw.timedOut);

  if (forceTimeout) {
    const finalState = withConfiguredCompletion(exercise, next, true);
    return { nextState: finalState, visitValue: { ...visitValue, timedOut: true }, calculatedScore: null, playerFinished: finalState.completed };
  }

  if (state.kind === "BOB27") {
    const hits = Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
    const index = state.targetIndex ?? 0;
    const doubleValue = index < 20 ? (index + 1) * 2 : 50;
    const score = (state.score ?? 27) + (hits > 0 ? hits * doubleValue : -doubleValue);
    const completed = score <= 0 || index >= 20;
    Object.assign(next, { score, hits: (state.hits ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + 3, targetIndex: completed ? index : index + 1, target: completed ? state.target : index + 1 < 20 ? `D${index + 2}` : "DBull", completed });
    const finalState = withConfiguredCompletion(exercise, next);
    return { nextState: finalState, visitValue: { ...visitValue, hits, doubleValue, scoreAfter: score }, calculatedScore: score, playerFinished: finalState.completed };
  }

  if (state.kind.startsWith("AROUND_")) {
    const hits = Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
    const advance = Math.min(hits, 21 - (state.targetIndex ?? 0));
    const targetIndex = (state.targetIndex ?? 0) + advance;
    const completed = targetIndex >= 21;
    const prefix = state.kind === "AROUND_DOUBLES" ? "D" : state.kind === "AROUND_TREBLES" ? "T" : "";
    const target = completed ? "Fertig" : targetIndex === 20 ? (state.kind === "AROUND_CLOCK" ? "Bull" : "DBull") : `${prefix}${targetIndex + 1}`;
    Object.assign(next, { targetIndex, target, completed, hits: (state.hits ?? 0) + hits, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    const finalState = withConfiguredCompletion(exercise, next);
    return { nextState: finalState, visitValue: { ...visitValue, hits, targetAfter: target }, calculatedScore: targetIndex, playerFinished: finalState.completed };
  }

  if (state.kind === "X01") {
    const scored = Math.max(0, Math.min(180, Math.trunc(number(raw.score ?? raw.value))));
    const before = state.score ?? 501;
    const checkout = Boolean(raw.checkout);
    const remaining = before - scored;
    const bust = remaining < 0 || remaining === 1 || (remaining === 0 && !checkout);
    const score = bust ? before : remaining;
    const completed = score === 0 && checkout;
    Object.assign(next, { score, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    const finalState = withConfiguredCompletion(exercise, next);
    return { nextState: finalState, visitValue: { ...visitValue, scored, bust, remaining: score, checkout }, calculatedScore: scored, playerFinished: finalState.completed };
  }

  if (state.kind === "SHANGHAI" || state.kind === "JDC_CHALLENGE") {
    const single = Math.max(0, Math.min(3, Math.trunc(number(raw.single))));
    const double = Math.max(0, Math.min(3, Math.trunc(number(raw.double))));
    const triple = Math.max(0, Math.min(3, Math.trunc(number(raw.triple))));
    const targetNumber = number(state.target, 1);
    const roundScore = targetNumber * (single + double * 2 + triple * 3);
    const bonus = single > 0 && double > 0 && triple > 0 ? 100 : 0;
    const maxIndex = state.kind === "JDC_CHALLENGE" ? 5 : 6;
    const targetIndex = (state.targetIndex ?? 0) + 1;
    const completed = targetIndex > maxIndex;
    const target = completed ? "Fertig" : String((state.kind === "JDC_CHALLENGE" ? 10 : 1) + targetIndex);
    Object.assign(next, { score: (state.score ?? 0) + roundScore + bonus, targetIndex, target, completed, dartsThrown: (state.dartsThrown ?? 0) + 3 });
    const finalState = withConfiguredCompletion(exercise, next);
    return { nextState: finalState, visitValue: { ...visitValue, single, double, triple, roundScore, bonus }, calculatedScore: roundScore + bonus, playerFinished: finalState.completed };
  }

  const hits = raw.hits == null ? undefined : Math.max(0, Math.min(3, Math.trunc(number(raw.hits))));
  const score = number(raw.score ?? raw.value ?? hits);
  const finish = Boolean(raw.finish);
  Object.assign(next, { score: (state.score ?? 0) + score, hits: (state.hits ?? 0) + (hits ?? 0), dartsThrown: (state.dartsThrown ?? 0) + 3, attempts: (state.attempts ?? 0) + 1, completed: finish });
  const finalState = withConfiguredCompletion(exercise, next);
  return { nextState: finalState, visitValue: { ...visitValue, score, hits, finish }, calculatedScore: score, playerFinished: finalState.completed };
}
