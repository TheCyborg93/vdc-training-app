import { engineV3Profile, type EngineV3InputMode } from "@/lib/exercise-engine-v3";

export type EngineInputMode = EngineV3InputMode;

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
  pluginId?: string;
  liveMetrics?: string[];
  coachSignals?: string[];
};

export type Catch40ScoreResult = {
  score: number;
  target: number;
  dartsAllowed: 6 | 9;
  remaining: number;
  checkout: boolean;
  bust: boolean;
  reachedTarget: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function catch40DartLimit(targetValue: unknown): 6 | 9 {
  const target = Math.trunc(finiteNumber(targetValue, 40));
  return target >= 91 ? 9 : 6;
}

export function analyzeCatch40Score(targetValue: unknown, scoreValue: unknown): Catch40ScoreResult {
  const target = Math.max(40, Math.min(170, Math.trunc(finiteNumber(targetValue, 40))));
  const dartsAllowed = catch40DartLimit(target);
  const maxScore = dartsAllowed * 60;
  const score = Math.max(0, Math.min(maxScore, Math.trunc(finiteNumber(scoreValue, 0))));
  const checkout = score === target;
  const bust = score > target;

  return {
    score,
    target,
    dartsAllowed,
    remaining: checkout || bust ? 0 : target - score,
    checkout,
    bust,
    reachedTarget: checkout,
  };
}

export function engineDefinition(kind: string, configValue?: unknown): EngineDefinition {
  const config = objectValue(configValue);
  const plugin = engineV3Profile(kind, config);
  const definition: EngineDefinition = {
    kind,
    inputMode: plugin.inputMode,
    dartsPerVisit: plugin.dartsPerVisit,
    supportsUndo: true,
    sharedGame: plugin.sharedGame,
    pluginId: plugin.id,
    liveMetrics: plugin.liveMetrics,
    coachSignals: plugin.coachSignals,
  };

  if (plugin.inputMode === "SCORE" || plugin.inputMode === "X01") {
    definition.minScore = 0;
    definition.maxScore = kind === "CATCH_40"
      ? catch40DartLimit(config.target ?? config.startTarget) * 60
      : 180;
  }
  if (plugin.inputMode === "CHECKOUT") {
    definition.maxDarts = Math.max(1, Math.min(9, Math.trunc(finiteNumber(config.maxDarts ?? config.dartsPerAttempt, 3))));
  }
  if (["CRICKET", "KILLER", "BOARD_GAME", "CUSTOM"].includes(plugin.inputMode)) definition.supportsFinish = true;
  if (kind === "COUNT_UP" || kind === "FIVES") definition.supportsFinish = true;

  return definition;
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
  if (kind === "CATCH_40") {
    return analyzeCatch40Score(
      raw.target ?? config.target ?? config.startTarget,
      raw.score ?? raw.value,
    );
  }
  if (definition.inputMode === "SCORE") return { score: clamp(raw.score ?? raw.value, definition.minScore ?? 0, definition.maxScore ?? 180), finish: raw.finish === true };
  if (definition.inputMode === "X01") return {
    score: clamp(raw.score ?? raw.value, 0, 180),
    checkout: raw.checkout === true,
    checkoutType: ["NONE", "SINGLE", "DOUBLE", "TREBLE"].includes(String(raw.checkoutType)) ? String(raw.checkoutType) : "NONE",
    doubleIn: raw.doubleIn === true,
  };
  if (definition.inputMode === "CHECKOUT") {
    const result: Record<string, unknown> = {
      checkout: raw.checkout === true,
      dartsUsed: clamp(raw.dartsUsed, 1, definition.maxDarts ?? 3),
    };
    if (raw.score != null) result.score = clamp(raw.score, 0, 180);
    return result;
  }
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
