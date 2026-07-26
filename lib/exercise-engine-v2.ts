export type EngineInputMode = "HITS" | "SEGMENTS" | "SCORE" | "CHECKOUT" | "X01" | "CRICKET" | "KILLER" | "BOARD_GAME" | "CUSTOM";

export type EngineDefinition = {
  kind: string;
  inputMode: EngineInputMode;
  dartsPerVisit: number;
  minScore?: number;
  maxScore?: number;
  maxDarts?: number;
  supportsFinish?: boolean;
  supportsUndo: boolean;
  sharedGame: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function engineDefinition(kind: string, configValue?: unknown): EngineDefinition {
  const config = objectValue(configValue);
  const dartsPerVisit = Math.max(1, Math.min(9, Math.trunc(finiteNumber(config.dartsPerVisit, 3))));
  const sharedGame = config.sharedGame === true;

  if (["BOB27", "BOB27_CONFIGURED", "AROUND_CLOCK", "AROUND_DOUBLES", "AROUND_TREBLES", "AROUND_SEQUENCE", "HIT_ROUNDS", "HIT_TARGET"].includes(kind)) {
    return { kind, inputMode: "HITS", dartsPerVisit, supportsUndo: true, sharedGame };
  }
  if (["SHANGHAI", "SHANGHAI_CONFIGURED", "SEGMENT_POINTS", "SWITCH", "BASEBALL", "TARGET_SEQUENCE", "HALVE_IT"].includes(kind)) {
    return { kind, inputMode: "SEGMENTS", dartsPerVisit, supportsUndo: true, sharedGame };
  }
  if (["X01", "X01_CONFIGURED"].includes(kind)) {
    return { kind, inputMode: "X01", dartsPerVisit, minScore: 0, maxScore: 180, supportsUndo: true, sharedGame };
  }
  if (["GAME_121", "CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"].includes(kind)) {
    return { kind, inputMode: "CHECKOUT", dartsPerVisit, maxDarts: Math.max(1, Math.trunc(finiteNumber(config.maxDarts ?? config.dartsPerAttempt, 3))), supportsUndo: true, sharedGame };
  }
  if (kind === "CRICKET") return { kind, inputMode: "CRICKET", dartsPerVisit, supportsFinish: true, supportsUndo: true, sharedGame: true };
  if (kind === "KILLER") return { kind, inputMode: "KILLER", dartsPerVisit, supportsFinish: true, supportsUndo: true, sharedGame: true };
  if (["TIC_TAC_TOE", "CHASE_GAME"].includes(kind)) return { kind, inputMode: "BOARD_GAME", dartsPerVisit, supportsFinish: true, supportsUndo: true, sharedGame: true };
  if (["SCORING", "FIVES", "COUNT_UP"].includes(kind)) return { kind, inputMode: "SCORE", dartsPerVisit, minScore: 0, maxScore: 180, supportsFinish: kind !== "SCORING", supportsUndo: true, sharedGame };
  return { kind, inputMode: "CUSTOM", dartsPerVisit, supportsFinish: true, supportsUndo: true, sharedGame };
}

export function normalizeEngineVisit(kind: string, configValue: unknown, rawValue: unknown): Record<string, unknown> {
  const config = objectValue(configValue);
  const raw = objectValue(rawValue);
  const definition = engineDefinition(kind, config);
  const clamp = (value: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.trunc(finiteNumber(value, min))));

  if (definition.inputMode === "HITS") return { hits: clamp(raw.hits, 0, definition.dartsPerVisit) };
  if (definition.inputMode === "SEGMENTS") {
    const single = clamp(raw.single, 0, definition.dartsPerVisit);
    const double = clamp(raw.double, 0, definition.dartsPerVisit - single);
    const triple = clamp(raw.triple, 0, definition.dartsPerVisit - single - double);
    return { single, double, triple, hits: single + double + triple };
  }
  if (definition.inputMode === "SCORE") return { score: clamp(raw.score ?? raw.value, definition.minScore ?? 0, definition.maxScore ?? 180), finish: raw.finish === true };
  if (definition.inputMode === "X01") return {
    score: clamp(raw.score ?? raw.value, 0, 180),
    checkout: raw.checkout === true,
    checkoutType: ["NONE", "SINGLE", "DOUBLE", "TREBLE"].includes(String(raw.checkoutType)) ? String(raw.checkoutType) : "NONE",
    doubleIn: raw.doubleIn === true,
  };
  if (definition.inputMode === "CHECKOUT") return {
    checkout: raw.checkout === true,
    dartsUsed: clamp(raw.dartsUsed, 1, definition.maxDarts ?? 3),
    score: raw.score == null ? undefined : clamp(raw.score, 0, 180),
  };
  if (definition.inputMode === "CRICKET") return {
    target: String(raw.target ?? ""),
    marks: clamp(raw.marks ?? raw.hits, 0, 3),
    points: Math.max(0, Math.trunc(finiteNumber(raw.points, 0))),
    finish: raw.finish === true,
  };
  if (definition.inputMode === "KILLER") return {
    livesDelta: clamp(raw.livesDelta, -5, 5),
    killer: raw.killer === true,
    finish: raw.finish === true,
  };
  return { ...raw };
}
