import { engineDefinition, normalizeEngineVisit } from "@/lib/exercise-engine-v2";

export type EngineAuditResult = {
  engine: string;
  inputMode: string;
  dartsPerVisit: number;
  zeroVisitSupported: boolean;
  valid: boolean;
  details: string;
};

const ENGINE_CASES: Array<{
  engine: string;
  config?: Record<string, unknown>;
  zeroVisit?: Record<string, unknown>;
  expected?: Record<string, unknown>;
}> = [
  { engine: "BOB27", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "AROUND_CLOCK", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "AROUND_DOUBLES", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "AROUND_TREBLES", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "DOUBLES_ROUNDS", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "BULL_ROUNDS", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "HIT_ROUNDS", zeroVisit: { hits: 0 }, expected: { hits: 0 } },
  { engine: "SCORING", zeroVisit: { score: 0 }, expected: { score: 0 } },
  { engine: "TIME_BASED", zeroVisit: { score: 0 }, expected: { score: 0 } },
  { engine: "X01", zeroVisit: { score: 0 }, expected: { score: 0 } },
  { engine: "CHECKOUT_LADDER", zeroVisit: { checkout: false, dartsUsed: 3 }, expected: { checkout: false } },
  { engine: "SHANGHAI", zeroVisit: { single: 0, double: 0, triple: 0 }, expected: { hits: 0 } },
  { engine: "CATCH_40", config: { target: 40 }, zeroVisit: { score: 0, target: 40 }, expected: { score: 0, dartsAllowed: 6 } },
  { engine: "CATCH_40", config: { target: 91 }, zeroVisit: { score: 0, target: 91 }, expected: { score: 0, dartsAllowed: 9 } },
  { engine: "CRICKET", zeroVisit: { target: "20", marks: 0, points: 0 }, expected: { marks: 0, points: 0 } },
  { engine: "KILLER", zeroVisit: { livesDelta: 0 }, expected: { livesDelta: 0 } },
  { engine: "CUSTOM", zeroVisit: { value: 0 }, expected: { value: 0 } },
  { engine: "AUTO", zeroVisit: { value: 0 }, expected: { value: 0 } },
  { engine: "JDC_CHALLENGE" },
];

function matchesExpected(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => Object.is(actual[key], value));
}

export function runPhase6EngineAudit(): {
  ok: boolean;
  checkedAt: string;
  total: number;
  passed: number;
  failed: number;
  results: EngineAuditResult[];
} {
  const results = ENGINE_CASES.map((test): EngineAuditResult => {
    try {
      const definition = engineDefinition(test.engine, test.config);
      if (!Number.isInteger(definition.dartsPerVisit) || definition.dartsPerVisit < 1 || definition.dartsPerVisit > 9) {
        return {
          engine: test.engine,
          inputMode: definition.inputMode,
          dartsPerVisit: definition.dartsPerVisit,
          zeroVisitSupported: false,
          valid: false,
          details: "Ungültiges Dartlimit.",
        };
      }

      if (!test.zeroVisit || !test.expected) {
        return {
          engine: test.engine,
          inputMode: definition.inputMode,
          dartsPerVisit: definition.dartsPerVisit,
          zeroVisitSupported: true,
          valid: true,
          details: "Engine-Definition ist gültig; keine numerische Nullaufnahme erforderlich.",
        };
      }

      const normalized = normalizeEngineVisit(test.engine, test.config ?? {}, test.zeroVisit);
      const zeroVisitSupported = matchesExpected(normalized, test.expected);
      return {
        engine: test.engine,
        inputMode: definition.inputMode,
        dartsPerVisit: definition.dartsPerVisit,
        zeroVisitSupported,
        valid: zeroVisitSupported,
        details: zeroVisitSupported
          ? "Nullaufnahme wird vollständig normalisiert und gespeichert."
          : `Nullaufnahme weicht ab: ${JSON.stringify(normalized)}`,
      };
    } catch (error) {
      return {
        engine: test.engine,
        inputMode: "UNKNOWN",
        dartsPerVisit: 0,
        zeroVisitSupported: false,
        valid: false,
        details: error instanceof Error ? error.message : "Unbekannter Enginefehler.",
      };
    }
  });

  const passed = results.filter((result) => result.valid).length;
  return {
    ok: passed === results.length,
    checkedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
