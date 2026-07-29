"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { catch40DartLimit, engineDefinition } from "@/lib/exercise-engine-v2";

type ExerciseState = {
  kind?: string; visit?: number; score?: number; target?: string; dartsThrown?: number; hits?: number;
  startedAt?: number; deadlineAt?: number; completionMode?: string; completionValue?: number; attemptDarts?: number;
  successes?: number; engineConfig?: Record<string, unknown>; lives?: number; opened?: boolean;
  playerName?: string; trainingName?: string;
};

type Feedback = { tone: "success" | "error"; title: string; detail: string } | null;
type BusyAction = "undo" | "pause" | "finish" | null;
type Props = {
  resultType: string; exerciseName: string; trainingName?: string; playerName?: string; targetDescription?: string;
  completionMode?: string | null; completionValue?: number | null; state?: ExerciseState | null; disabled?: boolean;
  paused?: boolean; onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
  onUndo?: () => Promise<void> | void; onPause?: () => Promise<void> | void; onFinish?: () => Promise<void> | void;
};

const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const QUICK_SCORES = [20, 40, 60, 81, 100, 140, 180];

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function payloadSummary(payload: Record<string, unknown>) {
  if (typeof payload.score === "number") return `${payload.score} Punkte gespeichert`;
  if (typeof payload.hits === "number") return `${payload.hits} Treffer gespeichert`;
  if (typeof payload.checkout === "boolean") return payload.checkout ? `Checkout in ${payload.dartsUsed ?? "–"} Darts` : "Versuch gespeichert";
  if (typeof payload.marks === "number") return `${payload.marks} Marken gespeichert`;
  if (typeof payload.livesDelta === "number") return `Leben ${payload.livesDelta > 0 ? "+" : ""}${payload.livesDelta}`;
  if (typeof payload.target === "string") return `Ziel ${payload.target} gespeichert`;
  if (payload.finish) return "Übung abgeschlossen";
  return "Eingabe gespeichert";
}
function targetCopy(kind: string, target: string | undefined, exerciseName: string) {
  if (target) return kind.includes("CHECKOUT") || kind === "GAME_121" || kind === "CATCH_40" ? `Checkout ${target}` : `Treffer auf ${target}`;
  if (kind.includes("100_DARTS")) return "100 Darts";
  return exerciseName;
}
function modeLabel(mode: string, kind: string) {
  if (kind === "CATCH_40") return "Catch 40";
  return ({ SCORE: "Scoring", X01: "X01", SEGMENTS: "Segmente", HITS: "Treffer", CHECKOUT: "Checkout", CRICKET: "Cricket", KILLER: "Killer", BOARD_GAME: "Boardspiel" } as Record<string,string>)[mode] ?? "Ergebnis";
}

export default function ExerciseResultInput({
  resultType, exerciseName, trainingName, playerName, targetDescription,
  completionMode: configuredMode, completionValue: configuredValue, state, disabled = false, paused = false,
  onSubmit, onUndo, onPause, onFinish,
}: Props) {
  const [score, setScore] = useState("");
  const [single, setSingle] = useState(0); const [double, setDouble] = useState(0); const [triple, setTriple] = useState(0);
  const [checkout, setCheckout] = useState(false); const [checkoutType, setCheckoutType] = useState("NONE");
  const [doubleIn, setDoubleIn] = useState(false); const [dartsUsed, setDartsUsed] = useState(1);
  const [target, setTarget] = useState(""); const [marks, setMarks] = useState(0); const [points, setPoints] = useState(0);
  const [now, setNow] = useState(() => Date.now()); const [submitting, setSubmitting] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null); const [feedback, setFeedback] = useState<Feedback>(null);
  const [successPulse, setSuccessPulse] = useState(false);
  const timeoutSent = useRef(false); const feedbackTimer = useRef<number | null>(null); const scoreRef = useRef<HTMLInputElement | null>(null);

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
  const scoreInvalid = numericScore !== null && (
    !Number.isInteger(numericScore) || numericScore < 0 ||
    (kind === "CATCH_40" ? numericScore > catch40MaxScore : numericScore > 180 || IMPOSSIBLE_SCORES.has(numericScore))
  );

  function resetEntry() {
    setScore(""); setSingle(0); setDouble(0); setTriple(0); setCheckout(false); setCheckoutType("NONE");
    setDoubleIn(false); setDartsUsed(1); setMarks(0); setPoints(0);
  }
  function showFeedback(next: Feedback) {
    setFeedback(next);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), next?.tone === "error" ? 6000 : 2600);
  }

  useEffect(() => { timeoutSent.current = false; }, [state?.deadlineAt, state?.visit]);
  useEffect(() => { resetEntry(); setFeedback(null); }, [state?.visit, state?.target]);
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
  let currentTargetCopy = targetDescription ?? targetCopy(kind, state?.target, exerciseName);
  let module: React.ReactNode;

  if (definition.inputMode === "HITS") {
    module = <div className="vdcx-choice-grid">{Array.from({ length: definition.dartsPerVisit + 1 }, (_, hits) => <button type="button" disabled={locked} key={hits} onClick={() => void dispatch({ hits })}><strong>{hits}</strong><span>Treffer</span></button>)}</div>;
  } else if (definition.inputMode === "SEGMENTS") {
    module = <><div className="vdcx-segment-grid">{[["Single", single, setSingle], ["Doppel", double, setDouble], ["Treble", triple, setTriple]].map(([label, value, setter]) => <div className="vdcx-segment-control" key={String(label)}><span>{String(label)}</span><div><button type="button" disabled={locked || Number(value) <= 0} onClick={() => (setter as (n:number)=>void)(Math.max(0, Number(value)-1))}>−</button><strong>{Number(value)}</strong><button type="button" disabled={locked || Number(value) >= definition.dartsPerVisit} onClick={() => (setter as (n:number)=>void)(Math.min(definition.dartsPerVisit, Number(value)+1))}>+</button></div></div>)}</div><div className={`vdcx-balance ${usedDarts === definition.dartsPerVisit ? "is-ready" : usedDarts > definition.dartsPerVisit ? "is-error" : ""}`}><span>Erfasste Darts</span><strong>{usedDarts} / {definition.dartsPerVisit}</strong></div><PrimaryButton disabled={locked || usedDarts > definition.dartsPerVisit} busy={submitting} onClick={() => void dispatch({ single, double, triple, hits: usedDarts })}>Aufnahme speichern</PrimaryButton></>;
  } else if (definition.inputMode === "X01") {
    const inRule = String(config.inRule ?? "SINGLE"); const outRule = String(config.outRule ?? "DOUBLE");
    const displayScore = state?.score ?? Number(config.startScore ?? 501); currentValue = displayScore; valueLabel = "Punkte Rest"; currentTarget = `${outRule} Out`; currentTargetCopy = `${inRule} In · ${outRule} Out`;
    const nextRest = numericScore === null ? null : displayScore - numericScore;
    const bust = nextRest !== null && (nextRest < 0 || ((outRule === "DOUBLE" || outRule === "MASTER") && nextRest === 1));
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ checkout: checkoutType !== "NONE", checkoutType, doubleIn })} />{inRule === "DOUBLE" && !state?.opened && <Toggle active={doubleIn} disabled={locked} onClick={() => setDoubleIn(!doubleIn)}>Mit Doppel eröffnet</Toggle>}<div className="vdcx-toggle-grid"><Toggle active={checkoutType === "NONE"} disabled={locked} onClick={() => setCheckoutType("NONE")}>Kein Checkout</Toggle>{outRule === "SINGLE" && <Toggle active={checkoutType === "SINGLE"} disabled={locked} onClick={() => setCheckoutType("SINGLE")}>Single Out</Toggle>}<Toggle active={checkoutType === "DOUBLE"} disabled={locked} onClick={() => setCheckoutType("DOUBLE")}>Double Out</Toggle>{outRule === "MASTER" && <Toggle active={checkoutType === "TREBLE"} disabled={locked} onClick={() => setCheckoutType("TREBLE")}>Treble Out</Toggle>}</div><Guidance tone={scoreInvalid ? "error" : bust ? "warning" : nextRest !== null ? "info" : "neutral"}>{scoreInvalid ? "Bitte einen möglichen Score zwischen 0 und 180 eingeben." : bust ? "Bust: Der vorherige Rest bleibt bestehen." : nextRest !== null ? `Voraussichtlicher Rest: ${Math.max(0,nextRest)}` : "Score eingeben oder Schnellwert wählen."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore({ checkout: checkoutType !== "NONE", checkoutType, doubleIn })}>Aufnahme speichern</PrimaryButton></>;
  } else if (definition.inputMode === "CHECKOUT") {
    const maxDarts = definition.maxDarts ?? 3; currentValue = state?.successes ?? 0; valueLabel = "Erfolge"; currentTarget = state?.target ?? "–"; currentTargetCopy = `Checkout ${state?.target ?? "–"}`;
    module = <><div className="vdcx-mini-stats"><div><span>Finish</span><strong>{state?.target ?? "–"}</strong></div><div><span>Darts im Versuch</span><strong>{state?.attemptDarts ?? 0} / {maxDarts}</strong></div><div><span>Erfolge</span><strong>{state?.successes ?? 0}</strong></div></div>{kind === "GAME_121" && <ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ checkout, dartsUsed })} />}<div className="vdcx-toggle-grid"><Toggle active={!checkout} disabled={locked} onClick={() => setCheckout(false)}>Nicht geschafft</Toggle><Toggle active={checkout} success disabled={locked} onClick={() => setCheckout(true)}>Checkout geschafft</Toggle></div><DartsSelector value={dartsUsed} max={maxDarts} disabled={locked} onChange={setDartsUsed}/><PrimaryButton disabled={locked || (kind === "GAME_121" && (numericScore === null || scoreInvalid))} busy={submitting} onClick={() => void (kind === "GAME_121" ? submitScore({ checkout, dartsUsed }) : dispatch({ checkout, dartsUsed }))}>Versuch speichern</PrimaryButton></>;
  } else if (definition.inputMode === "CRICKET") {
    const targets = Array.isArray(config.targets) ? config.targets : [15,16,17,18,19,20,"BULL"]; currentValue = points; valueLabel = "Punkte"; currentTarget = target || String(state?.target ?? targets[0]); currentTargetCopy = "Marken und Zusatzpunkte";
    module = <><label className="vdcx-field"><span>Ziel</span><select disabled={locked} value={target || String(state?.target ?? targets[0])} onChange={e => setTarget(e.target.value)}>{targets.map(item => <option key={String(item)}>{String(item)}</option>)}</select></label><div className="vdcx-choice-grid is-four">{[0,1,2,3].map(value => <button type="button" disabled={locked} key={value} className={marks === value ? "is-active" : ""} onClick={() => setMarks(value)}><strong>{value}</strong><span>Marken</span></button>)}</div><label className="vdcx-field"><span>Zusatzpunkte</span><input disabled={locked} type="number" min="0" inputMode="numeric" value={points} onChange={e => setPoints(Number(e.target.value))}/></label><PrimaryButton disabled={locked} busy={submitting} onClick={() => void dispatch({ target: target || state?.target, marks, points })}>Aufnahme speichern</PrimaryButton></>;
  } else if (definition.inputMode === "KILLER") {
    const lives = state?.lives ?? Number(config.startLives ?? 3); currentValue = lives; valueLabel = "Leben"; currentTarget = state?.target ?? "Gegner"; currentTargetCopy = "Lebensstand verändern";
    module = <><div className="vdcx-choice-grid is-five">{[-3,-2,-1,0,1].map(value => <button type="button" disabled={locked} key={value} onClick={() => void dispatch({ livesDelta: value })}><strong>{value > 0 ? `+${value}` : value}</strong><span>Leben</span></button>)}</div><button type="button" className="vdcx-secondary" disabled={locked} onClick={() => void dispatch({ killer: true, livesDelta: 0 })}>Killerstatus aktivieren</button></>;
  } else if (definition.inputMode === "BOARD_GAME") {
    const targets = Array.isArray(config.targets) ? config.targets : []; currentTarget = state?.target ?? targets[0] ?? exerciseName; currentTargetCopy = "Aktuelles Spielfeld";
    module = <div className="vdcx-target-grid">{targets.map(item => <button type="button" disabled={locked} key={String(item)} onClick={() => void dispatch({ target: String(item) })}>{String(item)}</button>)}</div>;
  } else if (kind === "CATCH_40") {
    currentValue = state?.score ?? 0; valueLabel = "Punkte"; currentTarget = catch40Target; currentTargetCopy = `Catch 40 · ${catch40Darts} Darts`;
    const reached = numericScore !== null && numericScore >= catch40Target;
    module = <><div className="vdcx-mini-stats"><div><span>Aktuelles Ziel</span><strong>{catch40Target}</strong></div><div><span>Dartlimit</span><strong>{catch40Darts} Darts</strong></div><div><span>Maximaler Score</span><strong>{catch40MaxScore}</strong></div></div><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore({ target: catch40Target, dartsAllowed: catch40Darts, reachedTarget: reached })} max={catch40MaxScore} quickScores={[40, 60, 80, 100, 120, 180]} placeholder={`0–${catch40MaxScore}`} /><Guidance tone={scoreInvalid ? "error" : reached ? "info" : numericScore !== null ? "warning" : "neutral"}>{scoreInvalid ? `Bitte einen Score zwischen 0 und ${catch40MaxScore} eingeben.` : reached ? `Ziel ${catch40Target} erreicht oder übertroffen.` : numericScore !== null ? `${catch40Target - numericScore} Punkte unter dem Ziel.` : `Gesamtscore aus maximal ${catch40Darts} Darts eingeben.`}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore({ target: catch40Target, dartsAllowed: catch40Darts, reachedTarget: reached })}>Catch-40-Ergebnis speichern</PrimaryButton></>;
  } else {
    currentValue = state?.score ?? 0; valueLabel = "Punkte"; currentTarget = state?.target ?? (definition.inputMode === "SCORE" ? "Score" : exerciseName); currentTargetCopy = definition.inputMode === "SCORE" ? "Punkte dieser Aufnahme" : currentTargetCopy;
    module = <><ScoreInput ref={scoreRef} value={score} onChange={setScore} disabled={locked} onSubmit={() => void submitScore()} /><Guidance tone={scoreInvalid ? "error" : numericScore !== null ? "info" : "neutral"}>{scoreInvalid ? "Dieser Score ist nicht möglich." : numericScore !== null ? `${numericScore} Punkte bereit zum Speichern.` : "Score eingeben oder Schnellwert wählen."}</Guidance><PrimaryButton disabled={locked || numericScore === null || scoreInvalid} busy={submitting} onClick={() => void submitScore()}>Aufnahme speichern</PrimaryButton></>;
  }

  return <section className={`vdcx-shell ${submitting ? "is-saving" : ""} ${successPulse ? "is-success" : ""} ${paused ? "is-paused" : ""}`} aria-busy={submitting} data-engine-kind={kind}>
    <header className="vdcx-topbar"><div className="vdcx-training"><span>Training</span><strong>{trainingName ?? state?.trainingName ?? "Dart-Training"}</strong><small>{exerciseName}</small></div><div className="vdcx-player"><span>Wer ist dran</span><strong>{playerName ?? state?.playerName ?? "Aktiver Spieler"}</strong><small><i/>{paused ? "Pausiert" : submitting ? "Wird gespeichert" : "Bereit"}</small></div><button type="button" className="vdcx-finish" disabled={locked} onClick={() => void runAction("finish", onFinish ?? (() => dispatch({ finish: true }, false)))}><span>Beenden</span><b>×</b></button></header>
    <div className="vdcx-metrics"><Metric label="Aktueller Punktestand" value={currentValue} caption={valueLabel}/><Metric label="Aktuelles Ziel" value={currentTarget} caption={currentTargetCopy} target/></div>
    {(completionMode === "TIME_LIMIT" || limitCurrent != null) && completionValue ? <div className={`vdcx-limit ${remainingSeconds != null && remainingSeconds <= 30 ? "is-urgent" : ""}`}><span>{progressLabel}</span><strong>{progressValue}</strong></div> : null}
    <main className="vdcx-input"><div className="vdcx-input-head"><div><span>Eingabe</span><strong>{modeLabel(definition.inputMode, kind)}</strong></div><div><span>Aufnahme</span><strong>{state?.visit ?? 1}</strong></div></div><div className="vdcx-module">{module}</div>{feedback && <div className={`vdcx-feedback is-${feedback.tone}`} role="status" aria-live="polite"><b>{feedback.tone === "success" ? "✓" : "!"}</b><div><strong>{feedback.title}</strong><p>{feedback.detail}</p></div></div>}</main>
    <footer className="vdcx-actions"><button type="button" disabled={locked} onClick={() => void runAction("undo", onUndo)}><span>↶</span><strong>{busyAction === "undo" ? "Wird ausgeführt …" : "Rückgängig"}</strong></button><button type="button" className={paused ? "is-active" : ""} disabled={locked || !onPause} onClick={() => void runAction("pause", onPause)}><span>{paused ? "▶" : "Ⅱ"}</span><strong>{busyAction === "pause" ? "Wird ausgeführt …" : paused ? "Fortsetzen" : "Pause"}</strong></button></footer>
  </section>;
}

function Metric({ label, value, caption, target = false }: { label:string; value:string|number; caption:string; target?:boolean }) { return <article className={`vdcx-metric ${target ? "is-target" : ""}`}><span>{label}</span><strong key={String(value)}>{value}</strong><small>{caption}</small></article>; }
function PrimaryButton({ disabled, busy, onClick, children }: { disabled:boolean; busy:boolean; onClick:()=>void; children:React.ReactNode }) { return <button type="button" className="vdcx-primary" disabled={disabled} onClick={onClick}><span>{busy ? "Speichert …" : children}</span><b>→</b></button>; }
function Toggle({ active, success=false, disabled, onClick, children }: { active:boolean; success?:boolean; disabled:boolean; onClick:()=>void; children:React.ReactNode }) { return <button type="button" className={`vdcx-toggle ${active ? "is-active" : ""} ${success && active ? "is-success" : ""}`} disabled={disabled} onClick={onClick}>{children}</button>; }
function Guidance({ tone, children }: { tone:"neutral"|"info"|"warning"|"error"; children:React.ReactNode }) { return <div className={`vdcx-guidance is-${tone}`}>{children}</div>; }
function DartsSelector({ value, max, disabled, onChange }: { value:number; max:number; disabled:boolean; onChange:(n:number)=>void }) { return <div className="vdcx-darts"><span>Verwendete Darts</span><div>{Array.from({length:max},(_,i)=>i+1).map(n => <button type="button" disabled={disabled} className={value===n ? "is-active" : ""} key={n} onClick={() => onChange(n)}>{n}</button>)}</div></div>; }
const ScoreInput = forwardRef<HTMLInputElement, { value:string; onChange:(s:string)=>void; disabled:boolean; onSubmit:()=>void; max?:number; quickScores?:number[]; placeholder?:string }>(function ScoreInput({ value, onChange, disabled, onSubmit, max = 180, quickScores = QUICK_SCORES, placeholder = "0–180" }, ref) { return <div className="vdcx-score"><label><span>Score</span><input ref={ref} disabled={disabled} autoFocus type="number" inputMode="numeric" min="0" max={max} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && value !== "" && !disabled) { e.preventDefault(); onSubmit(); } }} placeholder={placeholder}/></label><div>{quickScores.filter(n => n <= max).map(n => <button type="button" disabled={disabled} className={value===String(n) ? "is-active" : ""} key={n} onClick={() => onChange(String(n))}>{n}</button>)}</div><small>Enter speichert die Aufnahme</small></div>; });
