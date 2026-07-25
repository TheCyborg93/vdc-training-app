import type { ExerciseCompletionMode, ExerciseEngine, ExerciseResultType, PrismaClient } from "@prisma/client";

type DefaultExercise = {
  name: string;
  shortDescription: string;
  description: string;
  instructions: string;
  defaultMinutes: number;
  difficulty: number;
  intensity: number;
  funFactor: number;
  learningCurve: number;
  resultType: ExerciseResultType;
  engine: ExerciseEngine;
  completionMode: ExerciseCompletionMode;
  completionValue?: number;
  categories: string[];
  tags: string[];
  favorite?: boolean;
};

export const defaultExercises: DefaultExercise[] = [
  {
    name: "Bob’s 27",
    shortDescription: "Doppeltraining von D1 bis Bull",
    description: "Starte mit 27 Punkten und spiele nacheinander D1 bis D20 sowie Doppel-Bull.",
    instructions: "Pro Ziel werden drei Darts geworfen. Treffer addieren den Doppelwert, kein Treffer zieht den Doppelwert ab. Ende nach Doppel-Bull oder bei 0 Punkten.",
    defaultMinutes: 20, difficulty: 6, intensity: 6, funFactor: 8, learningCurve: 8,
    resultType: "HITS_0_TO_3", engine: "BOB27", completionMode: "ENGINE_DEFAULT",
    categories: ["Doppel", "Mental"], tags: ["Doppel", "Klassiker", "Druck"], favorite: true,
  },
  {
    name: "Around the Clock Singles",
    shortDescription: "Zahlen 1 bis 20 und Bull",
    description: "Spiele alle Zahlen der Reihe nach und beende die Runde über Bull.",
    instructions: "Je Aufnahme drei Darts. Jeder Treffer rückt ein Ziel weiter. Die Übung endet nach dem Bull.",
    defaultMinutes: 15, difficulty: 3, intensity: 5, funFactor: 7, learningCurve: 7,
    resultType: "HITS_0_TO_3", engine: "AROUND_CLOCK", completionMode: "ENGINE_DEFAULT",
    categories: ["Treffer", "Wurftechnik"], tags: ["Singles", "Rhythmus", "Einsteiger"],
  },
  {
    name: "Around the Clock Doubles",
    shortDescription: "Alle Doppel nacheinander",
    description: "Spiele D1 bis D20 und Doppel-Bull in fester Reihenfolge.",
    instructions: "Drei Darts pro Aufnahme. Treffer rücken zum nächsten Doppel weiter.",
    defaultMinutes: 25, difficulty: 7, intensity: 7, funFactor: 7, learningCurve: 9,
    resultType: "HITS_0_TO_3", engine: "AROUND_DOUBLES", completionMode: "ENGINE_DEFAULT",
    categories: ["Doppel"], tags: ["Doppel", "Routine", "Matchvorbereitung"], favorite: true,
  },
  {
    name: "Around the Clock Trebles",
    shortDescription: "Alle Triple nacheinander",
    description: "Spiele T1 bis T20 in fester Reihenfolge.",
    instructions: "Drei Darts pro Aufnahme. Jeder Treffer führt zum nächsten Triple.",
    defaultMinutes: 25, difficulty: 9, intensity: 8, funFactor: 7, learningCurve: 9,
    resultType: "HITS_0_TO_3", engine: "AROUND_TREBLES", completionMode: "ENGINE_DEFAULT",
    categories: ["Scoring", "Präzision"], tags: ["Triple", "Gruppierung", "Fortgeschritten"],
  },
  {
    name: "501 Double Out",
    shortDescription: "Klassisches Matchtraining",
    description: "Spiele ein vollständiges 501-Leg mit Double-Out.",
    instructions: "Jede Aufnahme einzeln eintragen. Bust und Checkout werden automatisch geprüft.",
    defaultMinutes: 15, difficulty: 6, intensity: 7, funFactor: 9, learningCurve: 8,
    resultType: "SCORE_0_TO_180", engine: "X01", completionMode: "ENGINE_DEFAULT",
    categories: ["Matchtraining", "Checkout", "Scoring"], tags: ["501", "Double Out", "Match"], favorite: true,
  },
  {
    name: "301 Double Out",
    shortDescription: "Kurzes Leg mit Checkout-Fokus",
    description: "Spiele 301 mit Double-Out und konzentriere dich auf frühes Stellen.",
    instructions: "Jede Aufnahme einzeln melden. Ende nur auf exakt 0 mit bestätigtem Doppel.",
    defaultMinutes: 12, difficulty: 5, intensity: 7, funFactor: 8, learningCurve: 8,
    resultType: "SCORE_0_TO_180", engine: "X01", completionMode: "ENGINE_DEFAULT",
    categories: ["Checkout", "Stellen", "Matchtraining"], tags: ["301", "Double Out"],
  },
  {
    name: "Scoring 20 Aufnahmen",
    shortDescription: "Konstantes Scoring messen",
    description: "Spiele 20 vollständige Drei-Dart-Aufnahmen auf dein bevorzugtes Scoringfeld.",
    instructions: "Trage nach jeder Aufnahme den Score ein. Average und Highlights werden automatisch berechnet.",
    defaultMinutes: 15, difficulty: 5, intensity: 7, funFactor: 7, learningCurve: 8,
    resultType: "SCORE_0_TO_180", engine: "SCORING", completionMode: "VISIT_LIMIT", completionValue: 20,
    categories: ["Scoring", "Konstanz"], tags: ["Average", "20 Aufnahmen", "T20"], favorite: true,
  },
  {
    name: "Scoring 60 Darts",
    shortDescription: "60 Darts unter gleichbleibendem Fokus",
    description: "Spiele exakt 60 Darts und dokumentiere jede Aufnahme.",
    instructions: "20 Aufnahmen mit je drei Darts. Ziel ist ein stabiler Rhythmus ohne Ergebnisdruck.",
    defaultMinutes: 15, difficulty: 4, intensity: 7, funFactor: 6, learningCurve: 8,
    resultType: "SCORE_0_TO_180", engine: "SCORING", completionMode: "DART_LIMIT", completionValue: 60,
    categories: ["Scoring", "Mental"], tags: ["60 Darts", "Rhythmus", "Konstanz"],
  },
  {
    name: "Power Scoring 10 Minuten",
    shortDescription: "Scoring unter Zeitdruck",
    description: "Sammle zehn Minuten lang so viele Punkte wie möglich.",
    instructions: "Jede Aufnahme eintragen. Nach Ablauf der Zeit beendet die App die Übung automatisch.",
    defaultMinutes: 10, difficulty: 6, intensity: 9, funFactor: 8, learningCurve: 7,
    resultType: "SCORE_0_TO_180", engine: "TIME_BASED", completionMode: "TIME_LIMIT", completionValue: 10,
    categories: ["Scoring", "Mental"], tags: ["Zeitdruck", "Tempo", "Fokus"],
  },
  {
    name: "Shanghai 1–20",
    shortDescription: "Single, Doppel und Triple kombinieren",
    description: "Spiele jede Zahl von 1 bis 20 und sammle Punkte über Single, Doppel und Triple.",
    instructions: "Trage pro Runde die Anzahl Singles, Doppel und Triple ein. Ein Shanghai wird als Bonus erkannt.",
    defaultMinutes: 25, difficulty: 6, intensity: 6, funFactor: 9, learningCurve: 8,
    resultType: "CUSTOM", engine: "SHANGHAI", completionMode: "ENGINE_DEFAULT",
    categories: ["Scoring", "Präzision"], tags: ["Shanghai", "Segmente", "Variation"],
  },
  {
    name: "JDC Challenge",
    shortDescription: "Vielseitiger standardisierter Dartstest",
    description: "Eine vielseitige Challenge mit Scoring-, Doppel- und Zielaufgaben.",
    instructions: "Die aktuellen Ziele werden von der App vorgegeben. Ergebnisse jeder Runde einzeln erfassen.",
    defaultMinutes: 30, difficulty: 7, intensity: 8, funFactor: 9, learningCurve: 9,
    resultType: "CUSTOM", engine: "JDC_CHALLENGE", completionMode: "ENGINE_DEFAULT",
    categories: ["Allround", "Jugend", "Leistungstest"], tags: ["JDC", "Benchmark", "Allround"], favorite: true,
  },
  {
    name: "Doppel 16 Route",
    shortDescription: "D16, D8, D4, D2, D1",
    description: "Trainiere die klassische Halbierungsroute über die bevorzugten Doppel.",
    instructions: "Spiele jedes Ziel mit drei Darts. Treffer führen zum nächsten Ziel.",
    defaultMinutes: 15, difficulty: 5, intensity: 6, funFactor: 7, learningCurve: 9,
    resultType: "HITS_0_TO_3", engine: "DOUBLES_ROUNDS", completionMode: "ENGINE_DEFAULT",
    categories: ["Doppel", "Checkout"], tags: ["D16", "Lieblingsdoppel", "Route"],
  },
  {
    name: "Doppel 20 Route",
    shortDescription: "D20, D10, D5",
    description: "Trainiere die obere Doppelroute für sichere Match-Checkouts.",
    instructions: "Je Ziel drei Darts. Nach einem Treffer wird automatisch weitergeschaltet.",
    defaultMinutes: 12, difficulty: 5, intensity: 6, funFactor: 7, learningCurve: 8,
    resultType: "HITS_0_TO_3", engine: "DOUBLES_ROUNDS", completionMode: "ENGINE_DEFAULT",
    categories: ["Doppel", "Checkout"], tags: ["D20", "Route", "Match"],
  },
  {
    name: "Bull 30 Darts",
    shortDescription: "Single Bull und Bullseye festigen",
    description: "Wirf 30 Darts ausschließlich auf das Bull und erfasse die Treffer pro Aufnahme.",
    instructions: "Zehn Aufnahmen. Single Bull und Doppel-Bull zählen als Treffer; Details können in Varianten ergänzt werden.",
    defaultMinutes: 10, difficulty: 6, intensity: 6, funFactor: 8, learningCurve: 8,
    resultType: "HITS_0_TO_3", engine: "BULL_ROUNDS", completionMode: "DART_LIMIT", completionValue: 30,
    categories: ["Bull", "Präzision"], tags: ["Bull", "30 Darts", "Center"],
  },
  {
    name: "Triple 20 – 30 Darts",
    shortDescription: "Gruppierung auf T20",
    description: "Wirf 30 Darts auf die Triple 20 und erfasse pro Aufnahme die Treffer.",
    instructions: "Zehn Aufnahmen mit jeweils drei Darts. Nur Treffer im Triple zählen.",
    defaultMinutes: 10, difficulty: 7, intensity: 7, funFactor: 7, learningCurve: 8,
    resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", completionMode: "DART_LIMIT", completionValue: 30,
    categories: ["Scoring", "Präzision"], tags: ["T20", "Gruppierung", "30 Darts"],
  },
  {
    name: "Triple 19 – 30 Darts",
    shortDescription: "Alternative Scoringroute",
    description: "Wirf 30 Darts auf T19 und trainiere eine verlässliche Ausweichroute.",
    instructions: "Nur Treffer im Triple 19 zählen. Jede Aufnahme einzeln erfassen.",
    defaultMinutes: 10, difficulty: 7, intensity: 7, funFactor: 7, learningCurve: 8,
    resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", completionMode: "DART_LIMIT", completionValue: 30,
    categories: ["Scoring", "Präzision"], tags: ["T19", "Ausweichroute", "30 Darts"],
  },
  {
    name: "Checkout 41–60",
    shortDescription: "Kurze Checkouts sicher abschließen",
    description: "Trainiere die Finishbereiche 41 bis 60 mit beliebig vielen Aufnahmen pro Checkout.",
    instructions: "Aktuelles Finish spielen und Erfolg bestätigen. Nach erfolgreichem Checkout folgt der nächste Wert.",
    defaultMinutes: 20, difficulty: 5, intensity: 7, funFactor: 8, learningCurve: 9,
    resultType: "CHECKOUT", engine: "CHECKOUT_LADDER", completionMode: "ENGINE_DEFAULT",
    categories: ["Checkout", "Stellen"], tags: ["41-60", "Finish", "Doppel"],
  },
  {
    name: "Checkout 61–80",
    shortDescription: "Zwei- und Drei-Dart-Finishes",
    description: "Trainiere Checkouts von 61 bis 80 mit klarer Routenentscheidung.",
    instructions: "Jedes Finish bis zum Erfolg spielen. Die App führt danach zum nächsten Checkout.",
    defaultMinutes: 25, difficulty: 7, intensity: 8, funFactor: 8, learningCurve: 9,
    resultType: "CHECKOUT", engine: "CHECKOUT_LADDER", completionMode: "ENGINE_DEFAULT",
    categories: ["Checkout", "Stellen"], tags: ["61-80", "Finishwege", "Boardmanagement"], favorite: true,
  },
  {
    name: "Checkout 81–100",
    shortDescription: "Große Matchfinishes",
    description: "Trainiere Checkouts von 81 bis 100 und sichere dir feste Standardwege.",
    instructions: "Finish wiederholen, bis es erfolgreich abgeschlossen wurde. Danach folgt der nächste Wert.",
    defaultMinutes: 30, difficulty: 8, intensity: 8, funFactor: 8, learningCurve: 10,
    resultType: "CHECKOUT", engine: "CHECKOUT_LADDER", completionMode: "ENGINE_DEFAULT",
    categories: ["Checkout", "Stellen"], tags: ["81-100", "High Finish", "Match"],
  },
  {
    name: "121 in 9 Darts",
    shortDescription: "Klassische Checkout-Challenge",
    description: "Versuche 121 innerhalb von neun Darts zu checken. Bei Erfolg steigt das Ziel.",
    instructions: "Jede Aufnahme einzeln eingeben. Checkout nur mit Doppel bestätigen.",
    defaultMinutes: 20, difficulty: 8, intensity: 8, funFactor: 9, learningCurve: 9,
    resultType: "CHECKOUT", engine: "CHECKOUT_LADDER", completionMode: "VISIT_LIMIT", completionValue: 3,
    categories: ["Checkout", "Mental"], tags: ["121", "9 Darts", "Druck"], favorite: true,
  },
  {
    name: "100 Darts auf D20",
    shortDescription: "Langzeittest auf ein Matchdoppel",
    description: "Wirf 100 Darts auf D20 und ermittle eine belastbare Trefferquote.",
    instructions: "Pro Aufnahme die Anzahl Treffer erfassen. Die App endet nach 100 Darts.",
    defaultMinutes: 30, difficulty: 6, intensity: 8, funFactor: 6, learningCurve: 9,
    resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", completionMode: "DART_LIMIT", completionValue: 100,
    categories: ["Doppel", "Konstanz"], tags: ["D20", "100 Darts", "Quote"],
  },
  {
    name: "100 Darts auf D16",
    shortDescription: "Langzeittest auf das Lieblingsdoppel",
    description: "Wirf 100 Darts auf D16 und analysiere deine langfristige Trefferquote.",
    instructions: "Treffer jeder Aufnahme einzeln erfassen. Ende nach 100 Darts.",
    defaultMinutes: 30, difficulty: 6, intensity: 8, funFactor: 6, learningCurve: 9,
    resultType: "HITS_0_TO_3", engine: "HIT_ROUNDS", completionMode: "DART_LIMIT", completionValue: 100,
    categories: ["Doppel", "Konstanz"], tags: ["D16", "100 Darts", "Quote"],
  },
];

export async function ensureDefaultExercises(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const item of defaultExercises) {
    let exercise = await prisma.exercise.findFirst({ where: { name: { equals: item.name, mode: "insensitive" } } });
    if (!exercise) {
      exercise = await prisma.exercise.create({
        data: {
          name: item.name,
          shortDescription: item.shortDescription,
          description: item.description,
          instructions: item.instructions,
          defaultMinutes: item.defaultMinutes,
          minPlayers: 1,
          difficulty: item.difficulty,
          intensity: item.intensity,
          funFactor: item.funFactor,
          learningCurve: item.learningCurve,
          resultType: item.resultType,
          engine: item.engine,
          completionMode: item.completionMode,
          completionValue: item.completionValue ?? null,
          tagsJson: item.tags,
          favorite: item.favorite ?? false,
          active: true,
        },
      });
      created += 1;
    }

    for (const categoryName of item.categories) {
      const category = await prisma.exerciseCategory.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });
      await prisma.exerciseCategoryLink.upsert({
        where: { exerciseId_categoryId: { exerciseId: exercise.id, categoryId: category.id } },
        update: {},
        create: { exerciseId: exercise.id, categoryId: category.id },
      });
    }
  }
  return created;
}
