export type EngineV3InputMode = "HITS" | "SEGMENTS" | "SCORE" | "CHECKOUT" | "X01" | "CRICKET" | "KILLER" | "BOARD_GAME" | "CUSTOM";

export type EngineV3Area = "SCORING" | "CHECKOUT" | "DOUBLES" | "BULL" | "CONSISTENCY" | "MENTAL" | "TACTICS";

export type EngineV3Plugin = {
  id: string;
  label: string;
  inputMode: EngineV3InputMode;
  defaultDartsPerVisit: number;
  sharedGame: boolean;
  areas: EngineV3Area[];
  liveMetrics: string[];
  coachSignals: string[];
  aliases: string[];
};

const plugins: EngineV3Plugin[] = [
  {
    id: "target-hits",
    label: "Zieltreffer",
    inputMode: "HITS",
    defaultDartsPerVisit: 3,
    sharedGame: false,
    areas: ["CONSISTENCY"],
    liveMetrics: ["Trefferquote", "Darts", "Ziel-Fortschritt"],
    coachSignals: ["targetAccuracy", "missStreak", "completionSpeed"],
    aliases: ["BOB27", "BOB27_CONFIGURED", "AROUND_CLOCK", "AROUND_DOUBLES", "AROUND_TREBLES", "AROUND_SEQUENCE", "HIT_ROUNDS", "HIT_TARGET"],
  },
  {
    id: "segment-training",
    label: "Segmenttraining",
    inputMode: "SEGMENTS",
    defaultDartsPerVisit: 3,
    sharedGame: false,
    areas: ["SCORING", "CONSISTENCY"],
    liveMetrics: ["Single", "Doppel", "Treble", "Punkte pro Aufnahme"],
    coachSignals: ["segmentDistribution", "trebleRate", "switchAccuracy"],
    aliases: ["SHANGHAI", "SHANGHAI_CONFIGURED", "SEGMENT_POINTS", "SWITCH", "BASEBALL", "TARGET_SEQUENCE", "HALVE_IT"],
  },
  {
    id: "x01",
    label: "X01 Match",
    inputMode: "X01",
    defaultDartsPerVisit: 3,
    sharedGame: false,
    areas: ["SCORING", "CHECKOUT", "MENTAL"],
    liveMetrics: ["Restscore", "Average", "Darts", "Busts", "Checkoutquote"],
    coachSignals: ["scoringAverage", "checkoutRate", "bustRate", "preferredCheckoutRoute"],
    aliases: ["X01", "X01_CONFIGURED"],
  },
  {
    id: "checkout",
    label: "Checkout Challenge",
    inputMode: "CHECKOUT",
    defaultDartsPerVisit: 3,
    sharedGame: false,
    areas: ["CHECKOUT", "DOUBLES", "MENTAL"],
    liveMetrics: ["Aktuelles Finish", "Versuche", "Erfolge", "Darts pro Checkout"],
    coachSignals: ["checkoutRate", "firstVisitFinish", "finishRange", "pressureTrend"],
    aliases: ["GAME_121", "CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"],
  },
  {
    id: "cricket",
    label: "Cricket",
    inputMode: "CRICKET",
    defaultDartsPerVisit: 3,
    sharedGame: true,
    areas: ["SCORING", "TACTICS", "MENTAL"],
    liveMetrics: ["Marken", "Offene Felder", "Punkte", "Führung"],
    coachSignals: ["marksPerVisit", "closingSpeed", "tacticalScoring"],
    aliases: ["CRICKET"],
  },
  {
    id: "killer",
    label: "Killer",
    inputMode: "KILLER",
    defaultDartsPerVisit: 3,
    sharedGame: true,
    areas: ["DOUBLES", "TACTICS", "MENTAL"],
    liveMetrics: ["Leben", "Killerstatus", "Eliminierungen"],
    coachSignals: ["qualificationSpeed", "survivalRate", "pressureAccuracy"],
    aliases: ["KILLER"],
  },
  {
    id: "board-game",
    label: "Board-Spiel",
    inputMode: "BOARD_GAME",
    defaultDartsPerVisit: 3,
    sharedGame: true,
    areas: ["TACTICS", "CONSISTENCY"],
    liveMetrics: ["Spielfeld", "Fortschritt", "Führung"],
    coachSignals: ["targetChoice", "boardCoverage", "gameEfficiency"],
    aliases: ["TIC_TAC_TOE", "CHASE_GAME", "JDC_CHALLENGE"],
  },
  {
    id: "score",
    label: "Score-Aufnahmen",
    inputMode: "SCORE",
    defaultDartsPerVisit: 3,
    sharedGame: false,
    areas: ["SCORING", "CONSISTENCY"],
    liveMetrics: ["Score", "Average", "Highscore", "Konstanz"],
    coachSignals: ["scoringAverage", "highVisitRate", "scoreDeviation"],
    aliases: ["SCORING", "FIVES", "COUNT_UP"],
  },
];

const fallback: EngineV3Plugin = {
  id: "custom",
  label: "Freie Ergebnisübung",
  inputMode: "CUSTOM",
  defaultDartsPerVisit: 3,
  sharedGame: false,
  areas: ["CONSISTENCY"],
  liveMetrics: ["Ergebnis", "Aufnahmen"],
  coachSignals: ["completionRate"],
  aliases: [],
};

const registry = new Map<string, EngineV3Plugin>();
for (const plugin of plugins) for (const alias of plugin.aliases) registry.set(alias, plugin);

export function resolveEngineV3(kind: string): EngineV3Plugin {
  return registry.get(kind) ?? fallback;
}

export function listEngineV3Plugins(): EngineV3Plugin[] {
  return [...plugins, fallback];
}

export function engineV3Profile(kind: string, configValue?: unknown) {
  const plugin = resolveEngineV3(kind);
  const config = configValue && typeof configValue === "object" && !Array.isArray(configValue) ? configValue as Record<string, unknown> : {};
  const configuredDarts = Number(config.dartsPerVisit);
  const dartsPerVisit = Number.isFinite(configuredDarts) ? Math.max(1, Math.min(9, Math.trunc(configuredDarts))) : plugin.defaultDartsPerVisit;
  return {
    ...plugin,
    dartsPerVisit,
    sharedGame: config.sharedGame === true || plugin.sharedGame,
  };
}
