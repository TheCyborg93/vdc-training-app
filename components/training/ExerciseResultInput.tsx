"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ExerciseState = {
  kind?: string;
  visit?: number;
  score?: number;
  target?: string;
  targetIndex?: number;
  dartsThrown?: number;
  hits?: number;
  startedAt?: number;
  deadlineAt?: number;
  completionMode?: string;
  completionValue?: number;
  baseTarget?: number;
  attemptDarts?: number;
  highestTarget?: number;
  successes?: number;
  engineConfig?: Record<string, unknown>;
  marks?: Record<string, number>;
  lives?: number;
  phase?: string;
};

type Props = {
  resultType: string;
  exerciseName: string;
  completionMode?: string | null;
  completionValue?: number | null;
  state?: ExerciseState | null;
  disabled?: boolean;
  onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
};

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ExerciseResultInput({ resultType, exerciseName, completionMode: configuredMode, completionValue: configuredValue, state, disabled = false, onSubmit }: Props) {
  const [score, setScore] = useState("");
  const [single, setSingle] = useState("0");
  const [double, setDouble] = useState("0");
  const [triple, setTriple] = useState("0");
  const [checkout, setCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState("NONE");
  const [doubleIn, setDoubleIn] = useState(false);
  const [dartsUsed, setDartsUsed] = useState(3);
  const [target, setTarget] = useState("");
  const [marks, setMarks] = useState(0);
  const [points, setPoints] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const timeoutSent = useRef(false);
  const kind = state?.kind ?? "CUSTOM";
  const config = state?.engineConfig ?? {};
  const completionMode = configuredMode ?? state?.completionMode ?? "ENGINE_DEFAULT";
  const completionValue = configuredValue ?? state?.completionValue ?? null;

  const remainingSeconds = useMemo(() => completionMode === "TIME_LIMIT" && state?.deadlineAt ? Math.max(0, Math.ceil((state.deadlineAt - now) / 1000)) : null, [completionMode, state?.deadlineAt, now]);
  useEffect(() => { timeoutSent.current = false; }, [state?.deadlineAt, state?.visit]);
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

  async function submitScore(extra: Record<string, unknown> = {}, fixedScore?: number) {
    const value = fixedScore ?? (score === "" ? null : Number(score));
    if (value == null) return;
    await onSubmit({ score: value, ...extra });
    setScore(""); setCheckout(false); setCheckoutType("NONE"); setDoubleIn(false); setDartsUsed(3);
  }

  async function submitSegments() {
    await onSubmit({ single: Number(single), double: Number(double), triple: Number(triple), hits: Number(single) + Number(double) + Number(triple) });
    setSingle("0"); setDouble("0"); setTriple("0");
  }

  const usedVisits = Math.max(0, (state?.visit ?? 1) - 1);
  const limitCurrent = completionMode === "VISIT_LIMIT" ? usedVisits : completionMode === "DART_LIMIT" ? state?.dartsThrown ?? 0 : null;
  const limitLabel = completionMode === "VISIT_LIMIT" ? "Aufnahmen" : completionMode === "DART_LIMIT" ? "Darts" : null;
  const limitPercent = limitCurrent != null && completionValue ? Math.min(100, Math.round((limitCurrent / completionValue) * 100)) : 0;
  const limitPanel = (completionMode === "TIME_LIMIT" || limitCurrent != null) && completionValue ? <div className="competition-limit" aria-live="polite"><div className="competition-limit-copy"><small>{completionMode === "TIME_LIMIT" ? "Verbleibende Zeit" : limitLabel}</small><strong>{completionMode === "TIME_LIMIT" ? formatTime(remainingSeconds ?? completionValue * 60) : `${limitCurrent} / ${completionValue}`}</strong><span>{completionMode === "TIME_LIMIT" ? `${completionValue} Minuten Gesamtzeit` : `${Math.max(0, completionValue - (limitCurrent ?? 0))} verbleibend`}</span></div><div className="competition-limit-track"><span style={{ width: `${completionMode === "TIME_LIMIT" ? Math.max(0, Math.min(100, ((remainingSeconds ?? completionValue * 60) / (completionValue * 60)) * 100)) : limitPercent}%` }} /></div></div> : null;

  if (kind === "GAME_121") {
    const attemptDarts = state?.attemptDarts ?? 0;
    const dartsRemaining = Math.max(0, Number(config.dartsPerAttempt ?? 9) - attemptDarts);
    return <div className="competition-engine competition-engine-121">{limitPanel}<div className="engine-kicker">121 · Checkout-Challenge</div><div className="game121-status"><div><small>Restscore</small><strong>{state?.score ?? state?.target ?? 121}</strong></div><div><small>Darts im Versuch</small><strong>{attemptDarts} / {Number(config.dartsPerAttempt ?? 9)}</strong><span>{dartsRemaining} übrig</span></div><div><small>Gesicherter Wert</small><strong>{state?.baseTarget ?? 121}</strong></div></div><div className="engine-score-entry"><label>Score der Aufnahme<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} /></label></div><div className="engine-segmented"><button type="button" className={!checkout ? "is-active" : ""} onClick={() => setCheckout(false)}>Kein Checkout</button><button type="button" className={checkout ? "is-active is-success" : ""} onClick={() => setCheckout(true)}>Checkout geschafft</button></div><div className="engine-darts-select"><small>Verwendete Darts</small><div>{[1,2,3].map((value) => <button type="button" className={dartsUsed === value ? "is-active" : ""} key={value} onClick={() => setDartsUsed(value)}>{value}</button>)}</div></div><button className="button full engine-submit" disabled={disabled || score === ""} onClick={() => void submitScore({ checkout, dartsUsed })}>Aufnahme speichern</button></div>;
  }

  if (kind === "BOB27" || kind === "BOB27_CONFIGURED" || kind.startsWith("AROUND_") || kind === "DOUBLES_ROUNDS" || kind === "BULL_ROUNDS" || kind === "HIT_ROUNDS") {
    const index = Number(state?.targetIndex ?? 0);
    const doubleValue = index >= 20 ? 50 : (index + 1) * 2;
    const currentScore = state?.score ?? Number(config.startScore ?? 27);
    return <div className="competition-engine competition-engine-hits">{limitPanel}<div className="engine-kicker">Treffer auf {state?.target ?? "das aktuelle Ziel"}</div><div className="engine-hit-grid">{[0,1,2,3].map((hits) => <button disabled={disabled || remainingSeconds === 0} key={hits} onClick={() => void onSubmit({ hits })}><strong>{hits}</strong><span>Treffer</span>{(kind === "BOB27" || kind === "BOB27_CONFIGURED") && <em>Vorschau {hits === 0 ? currentScore - doubleValue : currentScore + hits * doubleValue}</em>}</button>)}</div></div>;
  }

  if (["SHANGHAI", "SHANGHAI_CONFIGURED", "SEGMENT_POINTS", "SWITCH", "BASEBALL", "TARGET_SEQUENCE", "HALVE_IT"].includes(kind)) {
    return <div className="competition-engine competition-engine-segments">{limitPanel}<div className="engine-kicker">Treffer auf {state?.target ?? "das aktuelle Ziel"}</div><div className="segment-entry">{[{label:"Single",value:single,set:setSingle},{label:"Doppel",value:double,set:setDouble},{label:"Treble",value:triple,set:setTriple}].map((item) => <label key={item.label}><span>{item.label}</span><input type="number" inputMode="numeric" min="0" max="3" value={item.value} onChange={(event) => item.set(event.target.value)} /></label>)}</div><button className="button full engine-submit" disabled={disabled || remainingSeconds === 0} onClick={() => void submitSegments()}>Aufnahme speichern</button></div>;
  }

  if (kind === "X01" || kind === "X01_CONFIGURED") {
    const inRule = String(config.inRule ?? "SINGLE");
    const outRule = String(config.outRule ?? "DOUBLE");
    return <div className="competition-engine competition-engine-score">{limitPanel}<div className="engine-kicker">{state?.score ?? config.startScore ?? 501} Rest · {outRule} Out</div><div className="engine-score-entry"><label>Aufnahme<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} /></label></div>{inRule === "DOUBLE" && !state?.opened && <button type="button" className={`engine-checkout-toggle ${doubleIn ? "is-active" : ""}`} onClick={() => setDoubleIn((value) => !value)}>Mit Doppel eröffnet</button>}<div className="engine-segmented"><button type="button" className={checkoutType === "NONE" ? "is-active" : ""} onClick={() => setCheckoutType("NONE")}>Kein Checkout</button><button type="button" className={checkoutType === "DOUBLE" ? "is-active is-success" : ""} onClick={() => setCheckoutType("DOUBLE")}>Double Out</button>{outRule === "MASTER" && <button type="button" className={checkoutType === "TREBLE" ? "is-active is-success" : ""} onClick={() => setCheckoutType("TREBLE")}>Treble Out</button>}</div><button className="button full engine-submit" disabled={disabled || score === ""} onClick={() => void submitScore({ checkout: checkoutType !== "NONE", checkoutType, doubleIn })}>Aufnahme speichern</button></div>;
  }

  if (["CHECKOUT_RANGE", "FIXED_CHECKOUT", "RANDOM_CHECKOUT"].includes(kind)) {
    return <div className="competition-engine competition-engine-121">{limitPanel}<div className="engine-kicker">Checkout {state?.target}</div><div className="engine-score-entry"><label>Geworfener Score<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} /></label></div><div className="engine-segmented"><button type="button" className={!checkout ? "is-active" : ""} onClick={() => setCheckout(false)}>Nicht gecheckt</button><button type="button" className={checkout ? "is-active is-success" : ""} onClick={() => setCheckout(true)}>Checkout geschafft</button></div><div className="engine-darts-select"><small>Verwendete Darts</small><div>{[1,2,3,4,5,6].map((value) => <button type="button" className={dartsUsed === value ? "is-active" : ""} key={value} onClick={() => setDartsUsed(value)}>{value}</button>)}</div></div><button className="button full engine-submit" disabled={disabled || score === ""} onClick={() => void submitScore({ checkout, dartsUsed })}>Versuch speichern</button></div>;
  }

  if (kind === "CRICKET") {
    const targets = Array.isArray(config.targets) ? config.targets : [15,16,17,18,19,20,"BULL"];
    return <div className="competition-engine competition-engine-custom">{limitPanel}<div className="engine-kicker">Cricket-Marken erfassen</div><label>Ziel<select value={target || String(state?.target ?? targets[0])} onChange={(event) => setTarget(event.target.value)}>{targets.map((item) => <option key={String(item)} value={String(item)}>{String(item)}</option>)}</select></label><div className="engine-hit-grid">{[0,1,2,3].map((value) => <button key={value} className={marks === value ? "is-active" : ""} onClick={() => setMarks(value)}><strong>{value}</strong><span>Marken</span></button>)}</div><label>Zusatzpunkte<input type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></label><button className="button full" onClick={() => void onSubmit({ target: target || state?.target, marks, points })}>Cricket-Aufnahme speichern</button></div>;
  }

  if (kind === "KILLER") {
    return <div className="competition-engine competition-engine-custom">{limitPanel}<div className="engine-kicker">Killer · {state?.lives ?? config.startLives ?? 3} Leben</div><div className="engine-hit-grid">{[-3,-2,-1,0,1].map((value) => <button key={value} onClick={() => void onSubmit({ livesDelta: value })}><strong>{value > 0 ? `+${value}` : value}</strong><span>Leben</span></button>)}</div><button className="button secondary full" onClick={() => void onSubmit({ killer: true, livesDelta: 0 })}>Killerstatus aktivieren</button></div>;
  }

  if (kind === "TIC_TAC_TOE") {
    const targets = Array.isArray(config.targets) ? config.targets : [];
    return <div className="competition-engine competition-engine-custom"><div className="engine-kicker">Tic Tac Toe</div><div className="score-quick-grid">{targets.map((item) => <button key={String(item)} onClick={() => void onSubmit({ target: String(item) })}>{String(item)}</button>)}</div><button className="button secondary full" onClick={() => void onSubmit({ finish: true })}>Spiel abschließen</button></div>;
  }

  if (["SCORING", "FIVES", "COUNT_UP"].includes(kind) || resultType === "SCORE_0_TO_180") {
    return <div className="competition-engine competition-engine-score">{limitPanel}<div className="engine-kicker">Score dieser Aufnahme</div><div className="engine-score-entry"><label>Score<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} /></label></div><div className="score-quick-grid">{[0,26,41,45,60,81,100,140,180].map((value) => <button type="button" key={value} onClick={() => setScore(String(value))}>{value}</button>)}</div><button className="button full engine-submit" disabled={disabled || score === ""} onClick={() => void submitScore()}>Aufnahme speichern</button></div>;
  }

  return <div className="competition-engine competition-engine-custom">{limitPanel}<div className="engine-kicker">Ergebnis dieser Aufnahme</div><div className="engine-score-entry"><label>Wert<input type="number" inputMode="numeric" min="0" value={score} onChange={(event) => setScore(event.target.value)} /></label></div><div className="engine-custom-actions"><button className="button" disabled={disabled || score === ""} onClick={() => void submitScore()}>Aufnahme speichern</button><button className="button secondary" disabled={disabled} onClick={() => void onSubmit({ value: score === "" ? 0 : Number(score), finish: true })}>Übung abschließen</button></div></div>;
}
