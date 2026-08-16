"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { catch40DartLimit, engineDefinition } from "@/lib/exercise-engine-v2";

type ExerciseState = {
  kind?: string;
  visit?: number;
  score?: number;
  target?: string;
  dartsThrown?: number;
  hits?: number;
  startedAt?: number;
  deadlineAt?: number;
  completionMode?: string;
  completionValue?: number;
  attemptDarts?: number;
  attempts?: number;
  successes?: number;
  engineConfig?: Record<string, unknown>;
  lives?: number;
  opened?: boolean;
  phase?: string;
  opponentScore?: number;
  playerName?: string;
  trainingName?: string;
};

type Feedback = { tone: "success" | "error"; title: string; detail: string } | null;
type BusyAction = "undo" | "pause" | "finish" | null;

type Props = {
  resultType: string;
  exerciseName: string;
  trainingName?: string;
  playerName?: string;
  targetDescription?: string;
  completionMode?: string | null;
  completionValue?: number | null;
  state?: ExerciseState | null;
  disabled?: boolean;
  paused?: boolean;
  onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
  onUndo?: () => Promise<void> | void;
  onPause?: () => Promise<void> | void;
  onFinish?: () => Promise<void> | void;
};

const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const QUICK_SCORES = [0, 20, 40, 60, 81, 100, 140, 180];

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function payloadSummary(payload: Record<string, unknown>) {
  if (payload.gotcha === true) return "Aufnahme gespeichert · Gegner auf 0 gesetzt";
  if (Array.isArray(payload.hitSegments) || Array.isArray(payload.segmentHits)) {
    const values = (Array.isArray(payload.hitSegments) ? payload.hitSegments : payload.segmentHits as unknown[]).filter(Boolean);
    return `${values.join(", ") || "0 Treffer"} gespeichert`;
  }
  if (typeof payload.score === "number") return `${payload.score} Punkte gespeichert`;
  if (typeof payload.hits === "number") return `${payload.hits} Treffer gespeichert`;
  if (typeof payload.checkout === "boolean") return payload.checkout ? `Checkout in ${payload.dartsUsed ?? "–"} Darts` : "Fehlversuch gespeichert";
  if (typeof payload.marks === "number") return `${payload.marks} Marken gespeichert`;
  if (typeof payload.livesDelta === "number") return `Leben ${payload.livesDelta > 0 ? "+" : ""}${payload.livesDelta}`;
  if (payload.finish) return "Übung abgeschlossen";
  return "Aufnahme gespeichert";
}

function modeLabel(mode: string, kind: string) {
  if (kind === "CATCH_40") return "Catch 40";
  if (kind === "COUNT_UP") return "Gotcha";
  if (kind === "JDC_CHALLENGE") return "JDC Challenge";
  if (kind === "HALVE_IT") return "Halve It";
  if (kind === "FIXED_CHECKOUT") return "170 Big Fish";
  return ({ SCORE: "Scoring", X01: "X01", SEGMENTS: "Segmente", HITS: "Treffer", CHECKOUT: "Checkout", CRICKET: "Cricket", KILLER: "Killer", BOARD_GAME: "Boardspiel" } as Record<string, string>)[mode] ?? "Ergebnis";
}

function segmentValue(label: string) {
  const value = label.toUpperCase();
  if (value === "DBULL") return 50;
  const number = Number(value.slice(1));
  if (!Number.isFinite(number)) return 0;
  return number * (value.startsWith("D") ? 2 : value.startsWith("T") ? 3 : 0);
}

export default function ExerciseResultInput({
  exerciseName,
  trainingName,
  playerName,
  targetDescription,
  completionMode: configuredMode,
  completionValue: configuredValue,
  state,
  disabled = false,
  paused = false,
  onSubmit,
  onUndo,
  onPause,
  onFinish,
}: Props) {
  const [score, setScore] = useState("");
  const [single, setSingle] = useState(0);
  const [double, setDouble] = useState(0);
  const [triple, setTriple] = useState(0);
  const [checkout, setCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState("NONE");
  const [doubleIn, setDoubleIn] = useState(false);
  const [dartsUsed, setDartsUsed] = useState(1);
  const [target, setTarget] = useState("");
  const [marks, setMarks] = useState(0);
  const [points, setPoints] = useState(0);
  const [halveDarts, setHalveDarts] = useState(["", "", ""]);
  const [opponentScore, setOpponentScore] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [successPulse, setSuccessPulse] = useState(false);
  const timeoutSent = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const scoreRef = useRef<HTMLInputElement | null>(null);

  const kind = state?.kind ?? "CUSTOM";
  const config = state?.engineConfig ?? {};
  const definition = engineDefinition(kind, config);
  const completionMode = configuredMode ?? state?.completionMode ?? "ENGINE_DEFAULT";
  const completionValue = configuredValue ?? state?.completionValue ?? null;
  const remainingSeconds = useMemo(() => completionMode === "TIME_LIMIT" && state?.deadlineAt ? Math.max(0, Math.ceil((state.deadlineAt - now) / 1000)) : null, [completionMode, state?.deadlineAt, now]);
  const usedDarts = single + double + triple;
  const locked = disabled || paused || submitting || busyAction !== null;
  const numericScore = score === "" ? null : Number(score);
  const catch40Target = Math.max(40, Math.min(170, Math.trunc(Number(state?.target ?? config.target ?? config.startTarget ?? 40))));
  const catch40Darts = catch40DartLimit(catch40Target);
  const catch40MaxScore = catch40Darts * 60;
  const scoreInvalid = numericScore !== null && (!Number.isInteger(numericScore) || numericScore < 0 || (kind === "CATCH_40" ? numericScore > catch40MaxScore : numericScore > 180 || IMPOSSIBLE_SCORES.has(numericScore)));

  function resetEntry() {
    setScore(""); setSingle(0); setDouble(0); setTriple(0); setCheckout(false); setCheckoutType("NONE"); setDoubleIn(false); setDartsUsed(1); setMarks(0); setPoints(0); setHalveDarts(["", "", ""]);
  }

  function showFeedback(next: Feedback) {
    setFeedback(next);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), next?.tone === "error" ? 6000 : 2600);
  }

  useEffect(() => { timeoutSent.current = false; }, [state?.deadlineAt, state?.visit]);
  useEffect(() => {
    resetEntry(); setFeedback(null);
    if (state?.opponentScore != null) setOpponentScore(String(state.opponentScore));
  }, [state?.visit, state?.target, state?.opponentScore]);
  useEffect(() => {
    if (completionMode !== "TIME_LIMIT" || !state?.deadlineAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completionMode, state?.deadlineAt]);
  useEffect(() => {
    if (remainingSeconds !== 0 || timeoutSent.current || disabled) return;
    timeoutSent.current = true;
    void onSubmit({ timedOut: true, finish: true });
  }, [remainingSeconds, disabled, onSubmit]);
  useEffect(() => () => { if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current); }, []);

  async function dispatch(payload: Record<string, unknown>, reset = true) {
    if (locked) return;
    setSubmitting(true); setFeedback(null);
    try {
      await onSubmit(payload);
      showFeedback({ tone: "success", title: "Gespeichert", detail: payloadSummary(payload) });
      setSuccessPulse(true); window.setTimeout(() => setSuccessPulse(false), 480);
      if (reset && !payload.finish) resetEntry();
      if (payload.gotcha === true) setOpponentScore("0");
      window.requestAnimationFrame(() => scoreRef.current?.focus());
    } catch (error) {
      showFeedback({ tone: "error", title: "Nicht gespeichert", detail: error instanceof Error ? error.message : "Bitte erneut versuchen." });
    } finally { setSubmitting(false); }
  }

  async function runAction(type: Exclude<BusyAction, null>, callback?: () => Promise<void> | void) {
    if (locked) return;
    if (!callback) {
      if (type === "undo") { resetEntry(); showFeedback({ tone: "success", title: "Zurückgesetzt", detail: "Die aktuelle Eingabe wurde verworfen." }); }
      return;
    }
    setBusyAction(type);
    try { await callback(); }
    catch (error) { showFeedback({ tone: "error", title: "Aktion fehlgeschlagen", detail: error instanceof Error ? error.message : "Bitte erneut versuchen." }); }
    finally { setBusyAction(null); }
  }

  async function submitScore(extra: Record<string, unknown> = {}) {
    if (numericScore === null || scoreInvalid) return;
    await dispatch({ score: numericScore, ...extra });
  }

  const usedVisits = Math.max(0, (state?.visit ?? 1) - 1);
  const limitCurrent = completionMode === "VISIT_LIMIT" ? usedVisits : completionMode === "DART_LIMIT" ? state?.dartsThrown ?? 0 : null;
  const progressLabel = completionMode === "TIME_LIMIT" ? "Verbleibende Zeit" : completionMode === "DART_LIMIT" ? "Darts" : "Aufnahmen";
  const progressValue = completionMode === "TIME_LIMIT" ? formatTime(remainingSeconds ?? Number(completionValue ?? 0) * 60) : `${limitCurrent ?? 0} / ${completionValue ?? 0}`;

  let currentValue: string | number = state?.score ?? state?.hits ?? state?.lives ?? state?.successes ?? 0;
  let valueLabel = state?.score != null ? "Punkte" : kind === "KILLER" ? "Leben" : "Aktuell";
  let currentTarget: string | number = state?.target ?? exerciseName;
  let currentTargetCopy = targetDescription ?? exerciseName;
  let module: React.ReactNode;

  const halveTarget = String(state?.target ?? "").toUpperCase();
  if (kind === "HALVE_IT" && (halveTarget === "D" || halveTarget === "T")) {
    const prefix = halveTarget;
    const options = Array.from({ length: 20 }, (_, index) => `${prefix}${index + 1}`);
    if (prefix === "D") options.push("DBull");
    const chosen = halveDarts.filter(Boolean);
    const visitScore = chosen.reduce((sum, item) => sum + segmentValue(item), 0);
    currentTarget = prefix === "D" ? "Beliebiges Doppel" : "Beliebiges Triple";
    currentTargetCopy = prefix === "D" ? "D1–D20 oder DBull" : "T1–T20";
    module = <>
      <div className="vdcx-mini-stats"><div><span>Ziel</span><strong>{prefix}</strong></div><div><span>Treffer</span><strong>{chosen.length} / 3</strong></div><div><span>Punkte</span><strong>{visitScore}</strong></div></div>
      <div className="vdcx-segment-grid">{halveDarts.map((value, index) => <label className="vdcx-field" key={index}><span>Dart {index + 1}</span><select disabled={locked} value={value} onChange={(event) => setHalveDarts((old) => old.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}><option value="">Fehlwurf</option>{options.map((item) => <option key={item}>{item}</option>)}</select></label>)}</div>
      <Guidance tone={chosen.length === 0 ? "warning" : "info"}>{chosen.length === 0 ? "Kein Treffer: Der bisherige Gesamtscore wird halbiert." : `Getroffen: ${chosen.join(", ")} · ${visitScore} Punkte.`}</Guidance>
      <PrimaryButton disabled={locked} busy={submitting} onClick={() => void dispatch({ hitSegments: halveDarts, segmentHits: halveDarts, hits: chosen.length, single: 0, double: prefix === "D" ? chosen.length : 0, triple: prefix === "T" ? chosen.length : 0, visitScore })}>Aufnahme speichern</PrimaryButton>
    </>;
  } else if (kind === "JDC_CHALLENGE") {
    const phase = state?.phase ?? "SHANGHAI_10_15";
    const doublesPhase = phase === "DOUBLES";
    currentValue = state?.score ?? 0; valueLabel = "Gesamtpunkte"; currentTarget = state?.target ?? (doublesPhase ? "D1" : "10"); currentTargetCopy = doublesPhase ? "1 Dart auf das aktuelle Doppel" : `Shanghai ${phase === "SHANGHAI_15_20" ? "15–20" : "10–15"}`;
    module = doublesPhase ? <>
      <div className="vdcx-mini-stats"><div><span>Phase</span><strong>Doppel 1–20 + Bull</strong></div><div><span>Ziel</span><strong>{state?.target ?? "D1"}</strong></div><div><span>Gesamtscore</span><strong>{state?.score ?? 0}</strong></div></div>
      <div className="vdcx-choice-grid"><button disabled={locked} onClick={() => void dispatch({ hits: 0 })}><strong>0</strong><span>Verfehlt</span></button><button disabled={locked} onClick={() => void dispatch({ hits: 1 })}><strong>1</strong><span>Getroffen</span></button></div>
    </> : <>
      <div className="vdcx-mini-stats"><div><span>Phase</span><strong>{phase === "SHANGHAI_15_20" ? "Shanghai 15–20" : "Shanghai 10–15"}</strong></div><div><span>Ziel</span><strong>{state?.target ?? "–"}</strong></div><div><span>Gesamtscore</span><strong>{state?.score ?? 0}</strong></div></div>
      <SegmentControls single={single} double={double} triple={triple} setSingle={setSingle} setDouble={setDouble} setTriple={setTriple} used={usedDarts} max={3} locked={locked} />
      <PrimaryButton disabled={locked || usedDarts > 3} busy={submitting} onClick={() => void dispatch({ single, double, triple, hits: usedDarts })}>JDC-Aufnahme speichern</PrimaryButton>
    </>;
  } else if (definition.inputMode === "HITS") {
    module = <div className="vdcx-choice-grid">{Array.from({ length: definition.dartsPerVisit + 1 }, (_, hits) => <button type="button" disabled={locked} key={hits} onClick={() => void dispatch({ hits })}><strong>{hits}</strong><span>{hits === 0 ? "Keine Treffer" : "Treffer"}</span></button>)}</div>;
  } else if (definition.inputMode === "SEGMENTS") {
    module = <><SegmentControls single={single} double={double} triple={triple} setSingle={setSingle} setDouble={setDouble} setTriple={setTriple} used={usedDarts} max={definition.dartsPerVisit} locked={locked} /><PrimaryButton disabled={locked || usedDarts > definition.dartsPerVisit} busy={submitting} onClick={() => void dispatch({ single, double, triple, hits: usedDarts })}>Aufnahme speichern</PrimaryButton></>;
  } else if (definition.inputMode === "X01") {
    const inRule = String(config.inRule ?? "SINGLE"); const outRule = String(config.outRule ?? "DOUBLE"); const displayScore = state?.score ?? Number(config.startScore ?? 501);
    currentValue = displayScore; valueLabel = "Punkte Rest"; currentTarget = `${outRule} Out`; currentTargetCopy = `${inRule} In · ${outRule} Out`;
    const nextRest = numericScore === null ? null : displayScore - numericScore;
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ checkout: checkoutType !== "NONE", checkoutType, doubleIn })} />{inRule === "DOUBLE" && !state?.opened && <Toggle active={doubleIn} disabled={locked} onClick={() => setDoubleIn(!doubleIn)}>Mit Doppel eröffnet</Toggle>}<div className="vdcx-toggle-grid"><Toggle active={checkoutType === "NONE"} disabled={locked} onClick={() => setCheckoutType("NONE")}>Kein Checkout</Toggle><Toggle active={checkoutType === "DOUBLE"} disabled={locked} success onClick={() => setCheckoutType("DOUBLE")}>Double Out</Toggle></div><Guidance tone={nextRest !== null ? "info" : "neutral"}>{nextRest !== null ? `Voraussichtlicher Rest: ${Math.max(0, nextRest)}` : "Score eingeben."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore({ checkout: checkoutType !== "NONE", checkoutType, doubleIn })}>Aufnahme speichern</PrimaryButton></>;
  } else if (kind === "FIXED_CHECKOUT") {
    const startTarget = Number(config.target ?? 170);
    const remainingBefore = Math.max(0, state?.score ?? startTarget);
    const maxDarts = Number(config.maxDarts ?? 9);
    const attemptDarts = state?.attemptDarts ?? 0;
    const remainingDarts = Math.max(0, maxDarts - attemptDarts);
    const calculated = numericScore === null ? null : remainingBefore - numericScore;
    const bust = calculated !== null && (calculated < 0 || calculated === 1 || (calculated === 0 && !checkout));
    const previewRest = bust ? remainingBefore : calculated;
    const successMismatch = checkout && numericScore !== remainingBefore;
    const effectiveDarts = checkout ? dartsUsed : 3;
    currentValue = remainingBefore; valueLabel = "Restscore"; currentTarget = startTarget; currentTargetCopy = `${attemptDarts} / ${maxDarts} Darts im Versuch`;
    module = <>
      <div className="vdcx-mini-stats"><div><span>Rest</span><strong>{remainingBefore}</strong></div><div><span>Darts gespielt</span><strong>{attemptDarts} / {maxDarts}</strong></div><div><span>Versuch</span><strong>{(state?.attempts ?? 0) + 1} / {Number(config.rounds ?? 10)}</strong></div></div>
      <ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ checkout, dartsUsed: effectiveDarts })} max={180} quickScores={[0, 26, 40, 45, 60, 81, 100, 140, 180]} />
      <div className="vdcx-toggle-grid"><Toggle active={!checkout} disabled={locked} onClick={() => setCheckout(false)}>Nicht gecheckt</Toggle><Toggle active={checkout} success disabled={locked} onClick={() => setCheckout(true)}>Checkout geschafft</Toggle></div>
      {checkout && <DartsSelector value={dartsUsed} max={Math.min(3, Math.max(1, remainingDarts))} disabled={locked} onChange={setDartsUsed} />}
      <Guidance tone={scoreInvalid || successMismatch ? "error" : bust ? "warning" : numericScore !== null ? "info" : "neutral"}>{scoreInvalid ? "Bitte einen möglichen 3-Dart-Score zwischen 0 und 180 eingeben." : successMismatch ? `Für einen Checkout muss der eingegebene Score exakt dem Rest ${remainingBefore} entsprechen.` : bust ? `Bust – Rest bleibt ${remainingBefore}.` : numericScore !== null ? `Neuer Rest: ${previewRest}. ${checkout ? `Checkout in ${effectiveDarts} Dart${effectiveDarts === 1 ? "" : "s"}.` : `Diese Aufnahme zählt 3 Darts.`}` : "Score der nächsten Aufnahme eingeben."}</Guidance>
      <PrimaryButton disabled={locked || numericScore === null || scoreInvalid || successMismatch} busy={submitting} onClick={() => void submitScore({ checkout, dartsUsed: effectiveDarts })}>Aufnahme speichern</PrimaryButton>
    </>;
  } else if (definition.inputMode === "CHECKOUT") {
    const maxDarts = definition.maxDarts ?? 3;
    currentValue = state?.successes ?? 0; valueLabel = "Erfolge"; currentTarget = state?.target ?? "–"; currentTargetCopy = `Checkout ${state?.target ?? "–"}`;
    module = <><div className="vdcx-mini-stats"><div><span>Finish</span><strong>{state?.target ?? "–"}</strong></div><div><span>Darts</span><strong>{state?.attemptDarts ?? 0} / {maxDarts}</strong></div><div><span>Erfolge</span><strong>{state?.successes ?? 0}</strong></div></div>{kind === "GAME_121" && <ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ checkout, dartsUsed })} />}<div className="vdcx-toggle-grid"><Toggle active={!checkout} disabled={locked} onClick={() => setCheckout(false)}>Nicht geschafft</Toggle><Toggle active={checkout} success disabled={locked} onClick={() => setCheckout(true)}>Checkout geschafft</Toggle></div><DartsSelector value={dartsUsed} max={maxDarts} disabled={locked} onChange={setDartsUsed} /><PrimaryButton disabled={locked || (kind === "GAME_121" && (numericScore === null || scoreInvalid))} busy={submitting} onClick={() => void (kind === "GAME_121" ? submitScore({ checkout, dartsUsed }) : dispatch({ checkout, dartsUsed }))}>Versuch speichern</PrimaryButton></>;
  } else if (definition.inputMode === "CRICKET") {
    const targets = Array.isArray(config.targets) ? config.targets : [15, 16, 17, 18, 19, 20, "BULL"];
    module = <><label className="vdcx-field"><span>Ziel</span><select disabled={locked} value={target || String(state?.target ?? targets[0])} onChange={(event) => setTarget(event.target.value)}>{targets.map((item) => <option key={String(item)}>{String(item)}</option>)}</select></label><div className="vdcx-choice-grid is-four">{[0,1,2,3].map((value) => <button type="button" disabled={locked} key={value} onClick={() => setMarks(value)}><strong>{value}</strong><span>Marken</span></button>)}</div><label className="vdcx-field"><span>Zusatzpunkte</span><input disabled={locked} type="number" min="0" value={points} onChange={(event) => setPoints(Math.max(0, Number(event.target.value)))} /></label><PrimaryButton disabled={locked} busy={submitting} onClick={() => void dispatch({ target: target || state?.target || String(targets[0]), marks, points })}>Aufnahme speichern</PrimaryButton></>;
  } else if (definition.inputMode === "KILLER") {
    module = <div className="vdcx-choice-grid is-five">{[-3,-2,-1,0,1].map((value) => <button type="button" disabled={locked} key={value} onClick={() => void dispatch({ livesDelta: value })}><strong>{value}</strong><span>Leben</span></button>)}</div>;
  } else if (kind === "COUNT_UP") {
    const ownBefore = state?.score ?? 0; const targetScore = Number(config.target ?? 301); const opponent = opponentScore === "" ? null : Number(opponentScore); const total = numericScore === null ? null : ownBefore + numericScore; const bust = total !== null && total > targetScore; const ownAfter = bust ? ownBefore : total; const gotcha = ownAfter !== null && opponent !== null && opponent > 0 && ownAfter === opponent;
    currentValue = ownBefore; valueLabel = "Eigener Stand"; currentTarget = targetScore; currentTargetCopy = "Exakt erreichen";
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ opponentScore: opponent ?? 0, gotcha })} /><label className="vdcx-field"><span>Aktueller Gegnerstand</span><input disabled={locked} type="number" min="0" max={targetScore} value={opponentScore} onChange={(event) => setOpponentScore(event.target.value)} /></label><Guidance tone={gotcha ? "info" : bust ? "warning" : "neutral"}>{gotcha ? `Gotcha! Gegner wird auf 0 gesetzt.` : bust ? `Überworfen: Du bleibst bei ${ownBefore}.` : total !== null ? `Neuer Stand: ${ownAfter}.` : "Score eingeben."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid || opponent === null} busy={submitting} onClick={() => void submitScore({ opponentScore: opponent, gotcha })}>Gotcha-Aufnahme speichern</PrimaryButton></>;
  } else if (kind === "CATCH_40") {
    const reached = numericScore !== null && numericScore === catch40Target;
    currentValue = state?.score ?? 0; valueLabel = "Punkte"; currentTarget = catch40Target; currentTargetCopy = `${catch40Darts} Darts`;
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ target: catch40Target, dartsAllowed: catch40Darts, reachedTarget: reached })} max={catch40MaxScore} /><Guidance tone={scoreInvalid ? "error" : reached ? "info" : "neutral"}>{reached ? "Ziel exakt erreicht." : numericScore !== null ? `Rest: ${Math.max(0, catch40Target - numericScore)}` : "Score eingeben."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore({ target: catch40Target, dartsAllowed: catch40Darts, reachedTarget: reached })}>Catch-40-Ergebnis speichern</PrimaryButton></>;
  } else if (definition.inputMode === "BOARD_GAME") {
    const targets = Array.isArray(config.targets) ? config.targets : [];
    module = <div className="vdcx-target-grid">{targets.map((item) => <button type="button" disabled={locked} key={String(item)} onClick={() => void dispatch({ target: String(item) })}>{String(item)}</button>)}</div>;
  } else {
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore()} /><Guidance tone={scoreInvalid ? "error" : numericScore !== null ? "info" : "neutral"}>{scoreInvalid ? "Dieser Score ist nicht möglich." : numericScore !== null ? `${numericScore} Punkte bereit zum Speichern.` : "Score eingeben."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore()}>Aufnahme speichern</PrimaryButton></>;
  }

  return <section className={`vdcx-shell ${submitting ? "is-saving" : ""} ${successPulse ? "is-success" : ""} ${paused ? "is-paused" : ""}`} aria-busy={submitting} data-engine-kind={kind}>
    <header className="vdcx-topbar"><div className="vdcx-training"><span>Training</span><strong>{trainingName ?? state?.trainingName ?? "Dart-Training"}</strong><small>{exerciseName}</small></div><div className="vdcx-player"><span>Wer ist dran</span><strong>{playerName ?? state?.playerName ?? "Aktiver Spieler"}</strong><small><i />{paused ? "Pausiert" : submitting ? "Wird gespeichert" : "Bereit"}</small></div><button type="button" className="vdcx-finish" disabled={locked} onClick={() => void runAction("finish", onFinish ?? (() => dispatch({ finish: true }, false)))}><span>Beenden</span><b>×</b></button></header>
    <div className="vdcx-metrics"><Metric label="Aktueller Punktestand" value={currentValue} caption={valueLabel} /><Metric label="Aktuelles Ziel" value={currentTarget} caption={currentTargetCopy} target /></div>
    {(completionMode === "TIME_LIMIT" || limitCurrent != null) && completionValue ? <div className={`vdcx-limit ${remainingSeconds != null && remainingSeconds <= 30 ? "is-urgent" : ""}`}><span>{progressLabel}</span><strong>{progressValue}</strong></div> : null}
    <main className="vdcx-input"><div className="vdcx-input-head"><div><span>Eingabe</span><strong>{modeLabel(definition.inputMode, kind)}</strong></div><div><span>Aufnahme</span><strong>{state?.visit ?? 1}</strong></div></div><div className="vdcx-module">{module}</div>{feedback && <div className={`vdcx-feedback is-${feedback.tone}`} role="status"><b>{feedback.tone === "success" ? "✓" : "!"}</b><div><strong>{feedback.title}</strong><p>{feedback.detail}</p></div></div>}</main>
    <footer className="vdcx-actions"><button type="button" disabled={locked} onClick={() => void runAction("undo", onUndo)}><span>↶</span><strong>Rückgängig</strong></button><button type="button" className={paused ? "is-active" : ""} disabled={locked || !onPause} onClick={() => void runAction("pause", onPause)}><span>{paused ? "▶" : "Ⅱ"}</span><strong>{paused ? "Fortsetzen" : "Pause"}</strong></button></footer>
  </section>;
}

function SegmentControls({ single, double, triple, setSingle, setDouble, setTriple, used, max, locked }: { single: number; double: number; triple: number; setSingle: (n:number)=>void; setDouble:(n:number)=>void; setTriple:(n:number)=>void; used:number; max:number; locked:boolean }) {
  return <div className="vdcx-segment-grid">{[["Single", single, setSingle], ["Doppel", double, setDouble], ["Treble", triple, setTriple]].map(([label, value, setter]) => <div className="vdcx-segment-control" key={String(label)}><span>{String(label)}</span><div><button type="button" disabled={locked || Number(value) <= 0} onClick={() => (setter as (n:number)=>void)(Math.max(0, Number(value)-1))}>−</button><strong>{Number(value)}</strong><button type="button" disabled={locked || used >= max} onClick={() => (setter as (n:number)=>void)(Number(value)+1)}>+</button></div></div>)}</div>;
}
function Metric({ label, value, caption, target = false }: { label: string; value: string | number; caption: string; target?: boolean }) { return <article className={`vdcx-metric ${target ? "is-target" : ""}`}><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>; }
function PrimaryButton({ disabled, busy, onClick, children }: { disabled: boolean; busy: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" className="vdcx-primary" disabled={disabled} onClick={onClick}><span>{busy ? "Speichert …" : children}</span><b>→</b></button>; }
function Toggle({ active, success = false, disabled, onClick, children }: { active: boolean; success?: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" className={`vdcx-toggle ${active ? "is-active" : ""} ${success && active ? "is-success" : ""}`} disabled={disabled} onClick={onClick}>{children}</button>; }
function Guidance({ tone, children }: { tone: "neutral" | "info" | "warning" | "error"; children: React.ReactNode }) { return <div className={`vdcx-guidance is-${tone}`}>{children}</div>; }
function DartsSelector({ value, max, disabled, onChange }: { value: number; max: number; disabled: boolean; onChange: (n: number) => void }) { return <div className="vdcx-darts"><span>Verwendete Darts</span><div>{Array.from({ length: max }, (_, index) => index + 1).map((number) => <button type="button" disabled={disabled} className={value === number ? "is-active" : ""} key={number} onClick={() => onChange(number)}>{number}</button>)}</div></div>; }

const ScoreInput = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; disabled: boolean; onSubmit: () => void; max?: number; quickScores?: number[] }>(function ScoreInput({ value, onChange, disabled, onSubmit, max = 180, quickScores = QUICK_SCORES }, ref) {
  return <div className="vdcx-score"><label><span>Score</span><input ref={ref} disabled={disabled} autoFocus type="number" inputMode="numeric" min="0" max={max} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && value !== "" && !disabled) { event.preventDefault(); onSubmit(); } }} placeholder={`0–${max}`} /></label><div>{quickScores.filter((number) => number <= max).map((number) => <button type="button" disabled={disabled} className={value === String(number) ? "is-active" : ""} key={number} onClick={() => onChange(String(number))}>{number}</button>)}</div><small>0 ist eine gültige Aufnahme · Enter speichert</small></div>;
});
