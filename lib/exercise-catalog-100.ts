import type { ExerciseCompletionMode, ExerciseEngine, ExerciseResultType } from "@prisma/client";

export type CatalogExercise = {
  catalogNumber: number;
  name: string;
  shortDescription: string;
  description: string;
  instructions: string;
  defaultMinutes: number;
  minPlayers: number;
  maxPlayers?: number;
  difficulty: number;
  intensity: number;
  funFactor: number;
  learningCurve: number;
  resultType: ExerciseResultType;
  engine: ExerciseEngine;
  completionMode: ExerciseCompletionMode;
  completionValue?: number;
  resultConfigJson: Record<string, unknown>;
  categories: string[];
  tags: string[];
  favorite?: boolean;
};

type AddInput = Omit<CatalogExercise, "shortDescription" | "description" | "instructions" | "defaultMinutes" | "minPlayers" | "difficulty" | "intensity" | "funFactor" | "learningCurve" | "resultType" | "engine" | "completionMode" | "resultConfigJson" | "tags"> & {
  goal: string;
  flow: string;
  rules: string;
  defaultMinutes?: number;
  minPlayers?: number;
  maxPlayers?: number;
  difficulty?: number;
  intensity?: number;
  funFactor?: number;
  learningCurve?: number;
  resultType?: ExerciseResultType;
  engine?: ExerciseEngine;
  completionMode?: ExerciseCompletionMode;
  completionValue?: number;
  configEngine: string;
  config?: Record<string, unknown>;
  tags?: string[];
};

const catalog: CatalogExercise[] = [];

function add(input: AddInput) {
  catalog.push({
    catalogNumber: input.catalogNumber,
    name: input.name,
    shortDescription: input.goal,
    description: input.flow,
    instructions: input.rules,
    defaultMinutes: input.defaultMinutes ?? 20,
    minPlayers: input.minPlayers ?? 1,
    maxPlayers: input.maxPlayers,
    difficulty: input.difficulty ?? 6,
    intensity: input.intensity ?? 6,
    funFactor: input.funFactor ?? 7,
    learningCurve: input.learningCurve ?? 8,
    resultType: input.resultType ?? "CUSTOM",
    engine: input.engine ?? "CUSTOM",
    completionMode: input.completionMode ?? "ENGINE_DEFAULT",
    completionValue: input.completionValue,
    resultConfigJson: { catalogNumber: input.catalogNumber, engineType: input.configEngine, ...(input.config ?? {}) },
    categories: input.categories,
    tags: [...new Set([`#${String(input.catalogNumber).padStart(3, "0")}`, input.configEngine, ...(input.tags ?? [])])],
    favorite: input.favorite,
  });
}

const range = (start: number, end: number, step = 1) => {
  const result: number[] = [];
  if (step > 0) for (let value = start; value <= end; value += step) result.push(value);
  else for (let value = start; value >= end; value += step) result.push(value);
  return result;
};

[
  [1, "Singles", false, "SINGLE"], [2, "Singles", true, "SINGLE"],
  [3, "Doubles", false, "DOUBLE"], [4, "Doubles", true, "DOUBLE"],
  [5, "Trebles", false, "TREBLE"], [6, "Trebles", true, "TREBLE"],
].forEach(([catalogNumber, label, reverse, segment]) => add({
  catalogNumber: Number(catalogNumber),
  name: `Around the Clock - ${label} (${reverse ? "Rückwärts" : "Vorwärts"})`,
  goal: "Treffsicherheit auf dem gesamten Board verbessern.",
  flow: `${reverse ? "20 bis 1" : "1 bis 20"} und anschließend Bull spielen.`,
  rules: `Nur Treffer im ${label}-Segment führen zum nächsten Ziel.`,
  categories: ["Präzision", "Boardkontrolle", String(label)],
  resultType: "HITS_0_TO_3",
  engine: segment === "DOUBLE" ? "AROUND_DOUBLES" : segment === "TREBLE" ? "AROUND_TREBLES" : "AROUND_CLOCK",
  configEngine: "AROUND_SEQUENCE",
  config: { sequence: [...range(reverse ? 20 : 1, reverse ? 1 : 20, reverse ? -1 : 1), "BULL"], segment },
  difficulty: segment === "SINGLE" ? 3 : segment === "DOUBLE" ? 7 : 9,
  defaultMinutes: segment === "SINGLE" ? 18 : 25,
}));

[20, 19, 18, 17, 16, "BULL"].forEach((target, index) => add({
  catalogNumber: 7 + index,
  name: `100 Darts at ${target === "BULL" ? "Bullseye" : target}`,
  goal: `Konstantes Scoring und Rhythmus auf ${target === "BULL" ? "Bull" : target} aufbauen.`,
  flow: `Genau 100 Darts ausschließlich auf ${target === "BULL" ? "das Bullseye" : `die ${target}`}.`,
  rules: target === "BULL" ? "Single Bull = 1 Punkt, Bullseye = 2 Punkte." : "Single = 1 Punkt, Double = 2 Punkte, Treble = 3 Punkte.",
  categories: ["Scoring", "Konstanz", target === "BULL" ? "Bull" : "Präzision"],
  resultType: "CUSTOM",
  completionMode: "DART_LIMIT",
  completionValue: 100,
  configEngine: "SEGMENT_POINTS",
  config: { target, bull: target === "BULL", dartsPerVisit: 3 },
  defaultMinutes: 30,
}));

let number = 13;
for (const startScore of [301, 501, 701]) {
  for (const variant of [
    ["Single In / Single Out", "SINGLE", "SINGLE"],
    ["Single In / Double Out", "SINGLE", "DOUBLE"],
    ["Double In / Double Out", "DOUBLE", "DOUBLE"],
    ["Master Out (Double/Treble)", "SINGLE", "MASTER"],
  ]) {
    add({
      catalogNumber: number++,
      name: `${startScore} - ${variant[0]}`,
      goal: "Wettkampfsituation simulieren sowie Scoring und Checkouts trainieren.",
      flow: `Start bei ${startScore}. Pro Aufnahme werden bis zu drei Darts geworfen und abgezogen.`,
      rules: `Exakt 0 erreichen. In: ${variant[1]}, Out: ${variant[2]}. Bust setzt den Score zurück.`,
      categories: ["Matchtraining", "Scoring", "Checkout"],
      resultType: "SCORE_0_TO_180",
      engine: "X01",
      configEngine: "X01_CONFIGURED",
      config: { startScore, inRule: variant[1], outRule: variant[2] },
      defaultMinutes: startScore === 301 ? 15 : startScore === 501 ? 20 : 25,
      difficulty: 6,
    });
  }
}

for (let start = 61, catalogNumber = 25; catalogNumber <= 30; start += 10, catalogNumber++) {
  add({
    catalogNumber,
    name: `Catch 40 - Bereich ${start} bis ${start + 9}`,
    goal: "Sicherheit beim Checken spezifischer Restpunktzahlen verbessern.",
    flow: `Alle Zahlen von ${start} bis ${start + 9} nacheinander mit sechs Darts pro Zahl.`,
    rules: "Check in 2 Darts = 3 Punkte, 3 Darts = 2 Punkte, 4–6 Darts = 1 Punkt.",
    categories: ["Checkout", "Stellen", "Mental"],
    resultType: "CHECKOUT",
    engine: "CHECKOUT_LADDER",
    configEngine: "CHECKOUT_RANGE",
    config: { targets: range(start, start + 9), maxDarts: 6, scoring: { two: 3, three: 2, six: 1 } },
    defaultMinutes: 25,
    difficulty: 7,
  });
}

[
  [31, "Classic", 27, "CLASSIC", 7],
  [32, "Easy Mode", 50, "EASY", 5],
  [33, "Hardcore", 27, "HARDCORE", 9],
].forEach(([catalogNumber, label, startScore, mode, difficulty]) => add({
  catalogNumber: Number(catalogNumber),
  name: `Bob's 27 - ${label}`,
  goal: "Druckvolles Training aller Doppel-Felder.",
  flow: `Start mit ${startScore} Punkten. D1 bis D20 und Bull nacheinander.`,
  rules: "Treffer addieren den Doppelwert. Fehlwürfe werden abhängig von der Variante abgezogen.",
  categories: ["Doppel", "Mental", "Präzision"],
  resultType: "HITS_0_TO_3",
  engine: "BOB27",
  configEngine: "BOB27_CONFIGURED",
  config: { startScore, mode },
  defaultMinutes: 25,
  difficulty: Number(difficulty),
  favorite: Number(catalogNumber) === 31,
}));

const halveTracks: unknown[][] = [
  [20, 16, "D", 19, 15, "T", 18, 17, "BULL"],
  [12, 13, 14, "D", 15, 16, 17, "T", 18, 19, 20, "BULL"],
  [20, 19, 18, 17, 16, 15, "BULL"],
  ["T20", "T19", "T18", "T17", "T16", "T15", "BULL"],
  ["D20", "D16", "D8", "D4", "D2", "D1", "BULL"],
];
halveTracks.forEach((targets, index) => add({
  catalogNumber: 34 + index,
  name: `Halve It - Track ${index + 1}`,
  goal: "Nervenstärke unter Druck aufbauen.",
  flow: `Ziele nacheinander spielen: ${targets.join(", ")}.`,
  rules: "Treffer addieren Punkte. Kein Treffer mit drei Darts halbiert den Gesamtscore.",
  categories: ["Mental", "Scoring", "Präzision"],
  configEngine: "HALVE_IT",
  config: { targets, missPenalty: "HALVE" },
}));

const shanghaiTargets: unknown[][] = [range(1, 7), range(10, 16), [...range(15, 20), "BULL"], range(2, 14, 2), range(1, 13, 2), range(14, 20)];
const shanghaiLabels = ["1-7", "10-16", "15-20+Bull", "Gerade Zahlen (2-14)", "Ungerade Zahlen (1-13)", "14-20"];
shanghaiTargets.forEach((targets, index) => add({
  catalogNumber: 39 + index,
  name: `Shanghai - Ziele: ${shanghaiLabels[index]}`,
  goal: "Präzises Werfen auf Single, Double und Treble.",
  flow: `Ziele ${shanghaiLabels[index]} nacheinander, eine Zahl pro Runde.`,
  rules: "Single = 1x, Double = 2x, Treble = 3x. Ein vollständiger Shanghai wird erkannt.",
  categories: ["Scoring", "Präzision", "Variation"],
  engine: "SHANGHAI",
  configEngine: "SHANGHAI_CONFIGURED",
  config: { targets, instantShanghai: true },
}));

[
  [45, "Standard", "STANDARD"], [46, "Cut Throat", "CUT_THROAT"], [47, "No Score", "NO_SCORE"],
  [48, "Hidden", "HIDDEN"], [49, "Wildcard", "WILDCARD"], [50, "200", "RACE_200"],
].forEach(([catalogNumber, label, variant]) => add({
  catalogNumber: Number(catalogNumber),
  name: `Cricket - ${label}`,
  goal: "Taktisches Ziel- und Scoring-Spiel.",
  flow: "Cricket-Ziele werden über Singles, Doubles und Trebles geschlossen.",
  rules: "Drei Marken schließen ein Feld. Punkte- und Sieglogik richten sich nach der Variante.",
  categories: ["Matchtraining", "Taktik", "Gruppentraining"],
  minPlayers: 2,
  maxPlayers: 8,
  configEngine: "CRICKET",
  config: { variant, targets: [15, 16, 17, 18, 19, 20, "BULL"], sharedGame: true },
  defaultMinutes: 25,
  difficulty: 7,
}));

[
  [51, "Singles", "SINGLE", 5], [52, "Doubles", "DOUBLE", 3], [53, "Trebles", "TREBLE", 3],
  [54, "Blind", "BLIND", 3], [55, "Regeneration", "REGEN", 5],
].forEach(([catalogNumber, label, variant, startLives]) => add({
  catalogNumber: Number(catalogNumber),
  name: `Killer - ${label}`,
  goal: "Gruppenspiel mit Zielkontrolle und taktischem Druck.",
  flow: "Jeder Spieler erhält eine eigene Zahl und startet mit Leben.",
  rules: "Killerstatus und Lebensabzug richten sich nach der Segment-Variante.",
  categories: ["Gruppentraining", "Taktik", "Spaß"],
  minPlayers: 2,
  maxPlayers: 10,
  configEngine: "KILLER",
  config: { variant, startLives, sharedGame: true },
  defaultMinutes: 25,
}));

[20, 16, 8, 4, 10, 18, 9, 12, 6, 14, 7, 19, 17, 15, 13, 11, 5, 3, 2, 1].forEach((target, index) => add({
  catalogNumber: 56 + index,
  name: `Double Lock - D${target}`,
  goal: `Fokus auf D${target} festigen.`,
  flow: `100 Darts ausschließlich auf Doppel ${target}.`,
  rules: `Jeder Treffer in D${target} = 1 Punkt.`,
  categories: ["Doppel", "Konstanz", "Präzision"],
  resultType: "HITS_0_TO_3",
  engine: "HIT_ROUNDS",
  completionMode: "DART_LIMIT",
  completionValue: 100,
  configEngine: "HIT_TARGET",
  config: { target: `D${target}`, pointsPerHit: 1 },
  defaultMinutes: 30,
}));

[[20, 19], [18, 17], [16, 15], [20, 18], [19, 17]].forEach((targets, index) => add({
  catalogNumber: 76 + index,
  name: `Switch - ${targets[0]} & ${targets[1]}`,
  goal: "Schnelles Umschalten zwischen Zielen.",
  flow: `Dart 1 auf ${targets[0]}, Dart 2 auf ${targets[1]}, Dart 3 wieder auf ${targets[0]}; danach umgekehrt.`,
  rules: "Single = 1, Double = 2, Treble = 3; falsches Ziel = 0. Insgesamt 30 Darts.",
  categories: ["Scoring", "Wurftechnik", "Konzentration"],
  completionMode: "DART_LIMIT",
  completionValue: 30,
  configEngine: "SWITCH",
  config: { targets, dartsPerVisit: 3 },
  defaultMinutes: 12,
}));

add({ catalogNumber: 81, name: "Sniper - High Scoring", goal: "Konstanz auf großen Zahlen.", flow: "Je drei Darts auf 15, 16, 17, 18, 19 und 20.", rules: "Single=1, Double=2, Treble=3; nur das aktuelle Feld zählt.", categories: ["Scoring", "Präzision"], configEngine: "TARGET_SEQUENCE", config: { targets: range(15, 20), scoring: "MULTIPLIER" }, defaultMinutes: 12 });
add({ catalogNumber: 82, name: "Sniper - Low Scoring", goal: "Kontrolle bei kleinen Feldern.", flow: "Je drei Darts auf 1, 2, 3, 4, 5 und 6.", rules: "Single=1, Double=2, Treble=3; nur das aktuelle Feld zählt.", categories: ["Präzision", "Wurftechnik"], configEngine: "TARGET_SEQUENCE", config: { targets: range(1, 6), scoring: "MULTIPLIER" }, defaultMinutes: 12 });
add({ catalogNumber: 83, name: "Black & White", goal: "Präzision an Segmentgrenzen.", flow: "Abwechselnd schwarze und weiße Segmente anwerfen.", rules: "Ein Punkt pro Treffer im richtigen Segment.", categories: ["Präzision", "Konzentration"], resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", completionMode: "DART_LIMIT", completionValue: 30, configEngine: "HIT_TARGET", config: { target: "wechselnde Segmentfarbe" }, defaultMinutes: 12 });
add({ catalogNumber: 84, name: "Treble Hunt", goal: "Treble trainieren.", flow: "T20 bis T10 nacheinander, drei Darts pro Zahl.", rules: "Jeder Treffer gibt einen Punkt; nur Treble zählt.", categories: ["Scoring", "Präzision"], resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", configEngine: "TARGET_SEQUENCE", config: { targets: range(20, 10, -1).map((value) => `T${value}`), hitsOnly: true }, defaultMinutes: 15, difficulty: 8 });
add({ catalogNumber: 85, name: "Bullseye Challenge", goal: "Das Zentrum dominieren.", flow: "50 Darts ausschließlich auf Bull.", rules: "Single Bull = 1 Punkt, Bullseye = 2 Punkte.", categories: ["Bull", "Präzision"], completionMode: "DART_LIMIT", completionValue: 50, configEngine: "SEGMENT_POINTS", config: { target: "BULL", bull: true }, defaultMinutes: 18, difficulty: 7 });

add({ catalogNumber: 86, name: "121 - The Checkout Game", goal: "Checkout unter Druck trainieren.", flow: "Start bei 121 mit neun Darts Zeit; Erfolg erhöht das Ziel.", rules: "Erfolg führt zum nächsten Ziel, Misserfolg zum gesicherten Rückfallwert.", categories: ["Checkout", "Mental"], resultType: "CHECKOUT", engine: "CHECKOUT_LADDER", configEngine: "GAME_121", config: { startTarget: 121, maxTarget: 170, dartsPerAttempt: 9 }, defaultMinutes: 25, difficulty: 9, favorite: true });
add({ catalogNumber: 87, name: "170 - The Big Fish", goal: "Höchstes Finish trainieren.", flow: "Zehn Runden mit jeweils neun Darts auf 170.", rules: "Erfolgreicher Check innerhalb neun Darts = 1 Punkt.", categories: ["Checkout", "High Finish"], resultType: "CHECKOUT", configEngine: "FIXED_CHECKOUT", config: { target: 170, maxDarts: 9, rounds: 10 }, defaultMinutes: 20, difficulty: 10 });
add({ catalogNumber: 88, name: "JDC Challenge", goal: "Offizielle vielseitige JDC-Routine.", flow: "Bob's 27, Shanghai 10–15 und Around the Clock.", rules: "Punkte aller drei Abschnitte werden zum Gesamtscore addiert.", categories: ["Allround", "Leistungstest", "Jugend"], engine: "JDC_CHALLENGE", configEngine: "JDC_CHALLENGE", config: { stages: ["BOB27", "SHANGHAI_10_15", "AROUND_CLOCK"] }, defaultMinutes: 35, difficulty: 8, favorite: true });

[
  [89, "61 in 3 Darts", 61, 3, undefined],
  [90, "Finish 50 (Bull)", 50, 3, "BULL"],
  [91, "101 in 6", 101, 6, undefined],
  [92, "132 - The Bull Finish", 132, 9, "25-T19-BULL"],
].forEach(([catalogNumber, name, target, maxDarts, requiredRoute]) => add({
  catalogNumber: Number(catalogNumber), name: String(name),
  goal: "Checkoutwege und Abschluss unter Druck trainieren.",
  flow: `Start bei ${target}, maximal ${maxDarts} Darts.`,
  rules: "Checkout und tatsächlich verwendete Darts erfassen.",
  categories: ["Checkout", "Stellen"], resultType: "CHECKOUT", configEngine: "FIXED_CHECKOUT",
  config: { target, maxDarts, requiredRoute }, defaultMinutes: 15, difficulty: 8,
}));
add({ catalogNumber: 93, name: "Random Checkout", goal: "Improvisation bei Finishes.", flow: "Eine Zufallszahl zwischen 2 und 170 wird erzeugt.", rules: "Mit möglichst wenigen Darts checken und verwendete Darts erfassen.", categories: ["Checkout", "Stellen", "Mental"], resultType: "CHECKOUT", configEngine: "RANDOM_CHECKOUT", config: { min: 2, max: 170 }, defaultMinutes: 20, difficulty: 8 });

add({ catalogNumber: 94, name: "Fox and Hounds", goal: "Verfolgungsjagd auf dem Zahlenring.", flow: "Fuchs startet auf 20, Hunde auf 18 und bewegen sich im Uhrzeigersinn.", rules: "Bei Treffer weiterrücken; die Hunde gewinnen beim Überholen.", categories: ["Gruppentraining", "Spaß", "Präzision"], minPlayers: 2, maxPlayers: 8, configEngine: "CHASE_GAME", config: { variant: "FOX_HOUNDS", sharedGame: true } });
add({ catalogNumber: 95, name: "Baseball", goal: "Innings punkten.", flow: "Neun Runden, Runde 1 auf 1 bis Runde 9 auf 9.", rules: "Single=1, Double=2, Treble=3 Runs.", categories: ["Scoring", "Gruppentraining"], configEngine: "BASEBALL", config: { targets: range(1, 9) } });
add({ catalogNumber: 96, name: "Gotcha", goal: "Gegner durch exakte Scores resetten.", flow: "Von 0 exakt auf 301 hochspielen.", rules: "Exakter gegnerischer Score setzt den Gegner auf 0 zurück.", categories: ["Matchtraining", "Taktik", "Gruppentraining"], minPlayers: 2, maxPlayers: 8, configEngine: "COUNT_UP", config: { target: 301, gotcha: true, sharedGame: true } });
add({ catalogNumber: 97, name: "Chase the Dragon", goal: "Treble-Jagd.", flow: "T10 bis T20 und Bull nacheinander.", rules: "Nur Treffer im geforderten Treble führen weiter.", categories: ["Scoring", "Präzision"], resultType: "HITS_0_TO_3", engine: "AROUND_TREBLES", configEngine: "AROUND_SEQUENCE", config: { sequence: [...range(10, 20).map((value) => `T${value}`), "BULL"], segment: "EXACT" } });
add({ catalogNumber: 98, name: "Fives", goal: "Multiples von fünf trainieren.", flow: "Normale Drei-Dart-Aufnahmen auf das ganze Board.", rules: "Ist die Summe durch 5 teilbar, gibt Score/5 Punkte, sonst 0.", categories: ["Scoring", "Kopfrechnen"], resultType: "SCORE_0_TO_180", configEngine: "FIVES", config: {} });
add({ catalogNumber: 99, name: "Bermuda Triangle", goal: "Strafe bei Fehlern.", flow: "12, 13, 14, D, 15, 16, 17, T, 18, 19, 20, Bull.", rules: "Kein Treffer setzt den Gesamtscore auf 0.", categories: ["Mental", "Scoring", "Präzision"], configEngine: "HALVE_IT", config: { targets: [12, 13, 14, "D", 15, 16, 17, "T", 18, 19, 20, "BULL"], missPenalty: "RESET" } });
add({ catalogNumber: 100, name: "Tic Tac Toe", goal: "Taktisches Zielspiel.", flow: "Ein 3x3-Raster wird mit festgelegten Dart-Zahlen gespielt.", rules: "Treffer markiert ein Feld; drei in einer Reihe gewinnen.", categories: ["Taktik", "Gruppentraining", "Spaß"], minPlayers: 2, maxPlayers: 2, configEngine: "TIC_TAC_TOE", config: { targets: [20, 19, 18, 17, 16, 15, 14, 13, 12], sharedGame: true } });

export const exerciseCatalog100 = catalog.sort((a, b) => a.catalogNumber - b.catalogNumber);

if (exerciseCatalog100.length !== 100) {
  throw new Error(`Der Übungskatalog muss exakt 100 Übungen enthalten, aktuell: ${exerciseCatalog100.length}.`);
}
