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

function bob27DoubleValue(state?: ExerciseState | null): number {
  const index = Number(state?.targetIndex ?? 0);
  return index >= 20 ? 50 : (index + 1) * 2;
}

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ExerciseResultInput({ resultType, exerciseName, completionMode: configuredMode, completionValue: configuredValue, state, disabled = false, onSubmit }: Props) {
  const [score, setScore] = useState("");
  const [single, setSingle] = useState("0");
  const [double, setDouble] = useState("0");
  const [triple, setTriple] = useState("0");
  const [checkout, setCheckout] = useState(false);
  const [dartsUsed, setDartsUsed] = useState(3);
  const [now, setNow] = useState(() => Date.now());
  const timeoutSent = useRef(false);
  const kind = state?.kind ?? "CUSTOM";
  const completionMode = configuredMode ?? state?.completionMode ?? "ENGINE_DEFAULT";
  const completionValue = configuredValue ?? state?.completionValue ?? null;

  const remainingSeconds = useMemo(() => {
    if (completionMode !== "TIME_LIMIT" || !state?.deadlineAt) return null;
    return Math.max(0, Math.ceil((state.deadlineAt - now) / 1000));
  }, [completionMode, state?.deadlineAt, now]);

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
    setScore("");
    setCheckout(false);
    setDartsUsed(3);
  }

  const usedVisits = Math.max(0, (state?.visit ?? 1) - 1);
  const limitCurrent = completionMode === "VISIT_LIMIT" ? usedVisits : completionMode === "DART_LIMIT" ? state?.dartsThrown ?? 0 : null;
  const limitLabel = completionMode === "VISIT_LIMIT" ? "Aufnahmen" : completionMode === "DART_LIMIT" ? "Darts" : null;
  const limitPercent = limitCurrent != null && completionValue ? Math.min(100, Math.round((limitCurrent / completionValue) * 100)) : 0;

  const limitPanel = (completionMode === "TIME_LIMIT" || limitCurrent != null) && completionValue ? (
    <div className="exercise-limit-panel" aria-live="polite">
      <div><small>{completionMode === "TIME_LIMIT" ? "Verbleibende Zeit" : limitLabel}</small><strong>{completionMode === "TIME_LIMIT" ? formatTime(remainingSeconds ?? completionValue * 60) : `${limitCurrent} / ${completionValue}`}</strong><span>{completionMode === "TIME_LIMIT" ? `${completionValue} Minuten Gesamtzeit` : `${Math.max(0, completionValue - (limitCurrent ?? 0))} verbleibend`}</span></div>
      <div className="progress-track"><span style={{ width: `${completionMode === "TIME_LIMIT" ? Math.max(0, Math.min(100, ((remainingSeconds ?? completionValue * 60) / (completionValue * 60)) * 100)) : limitPercent}%` }} /></div>
    </div>
  ) : null;

  if (kind === "GAME_121") {
    const attemptDarts = state?.attemptDarts ?? 0;
    const dartsRemaining = Math.max(0, 9 - attemptDarts);
    return (
      <div className="visit-entry game121-entry">
        <div className="game121-status">
          <div><small>Restscore</small><strong>{state?.score ?? state?.target ?? 121}</strong></div>
          <div><small>Versuch</small><strong>{attemptDarts} / 9</strong><span>{dartsRemaining} Darts übrig</span></div>
          <div><small>Basiswert</small><strong>{state?.baseTarget ?? 121}</strong><span>Rückfall bei Fehlversuch</span></div>
        </div>
        <div className="numeric-result"><input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Score dieser Aufnahme" /></div>
        <div className="score-quick-grid">{[0, 26, 41, 45, 60, 81, 100, 121, 140, 180].map((value) => <button type="button" disabled={disabled} key={value} onClick={() => setScore(String(value))}>{value}</button>)}</div>
        <div className="game121-checkout-row">
          <button type="button" className={!checkout ? "is-active" : ""} disabled={disabled} onClick={() => setCheckout(false)}>Kein Checkout</button>
          <button type="button" className={checkout ? "is-active success" : ""} disabled={disabled} onClick={() => setCheckout(true)}>Checkout geschafft</button>
        </div>
        <div className="game121-darts">
          <small>Verwendete Darts in dieser Aufnahme</small>
          <div>{[1, 2, 3].map((value) => <button type="button" className={dartsUsed === value ? "is-active" : ""} disabled={disabled || value > dartsRemaining} key={value} onClick={() => setDartsUsed(value)}>{value}</button>)}</div>
        </div>
        <button className="button full" disabled={disabled || score === "" || dartsRemaining === 0} onClick={() => void submitScore({ checkout, dartsUsed })}>Aufnahme speichern</button>
      </div>
    );
  }

  if (kind === "BOB27" || kind.startsWith("AROUND_") || kind === "DOUBLES_ROUNDS" || kind === "BULL_ROUNDS" || kind === "HIT_ROUNDS") {
    const currentScore = state?.score ?? 27;
    const doubleValue = bob27DoubleValue(state);
    return <div className="visit-entry">{limitPanel}<div className="bob27-scoreboard" aria-live="polite"><div><small>Aktueller Punktestand</small><strong>{currentScore}</strong><span>Startwert 27</span></div></div><div className="result-button-grid bob27-buttons">{[0, 1, 2, 3].map((hits) => { const preview = hits === 0 ? currentScore - doubleValue : currentScore + hits * doubleValue; return <button disabled={disabled || remainingSeconds === 0} key={hits} onClick={() => void onSubmit({ hits })}><strong>{hits}</strong><span>Treffer</span>{kind === "BOB27" && <em>Danach {preview}</em>}</button>; })}</div><p className="visit-help">Eine Auswahl speichert genau diese Aufnahme und wechselt danach automatisch weiter.</p></div>;
  }

  if (kind === "SHANGHAI" || kind === "JDC_CHALLENGE") return <div className="visit-entry">{limitPanel}<div className="segment-entry"><label>Single<input type="number" inputMode="numeric" min="0" max="3" value={single} onChange={(event) => setSingle(event.target.value)} /></label><label>Double<input type="number" inputMode="numeric" min="0" max="3" value={double} onChange={(event) => setDouble(event.target.value)} /></label><label>Triple<input type="number" inputMode="numeric" min="0" max="3" value={triple} onChange={(event) => setTriple(event.target.value)} /></label></div><button className="button" disabled={disabled || remainingSeconds === 0} onClick={() => void onSubmit({ single: Number(single), double: Number(double), triple: Number(triple) })}>Aufnahme speichern</button></div>;

  if (kind === "X01") return <div className="visit-entry">{limitPanel}<div className="numeric-result"><input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Score 0–180" /></div><div className="score-quick-grid">{[26, 41, 45, 60, 81, 100, 140, 180].map((value) => <button type="button" disabled={disabled || remainingSeconds === 0} key={value} onClick={() => void submitScore({}, value)}>{value}</button>)}</div><label className="checkout-confirm"><input type="checkbox" checked={checkout} onChange={(event) => setCheckout(event.target.checked)} /> Mit Doppel ausgecheckt</label><button className="button" disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore({ checkout })}>Aufnahme speichern</button></div>;

  if (kind === "SCORING" || resultType === "SCORE_0_TO_180") return <div className="visit-entry">{limitPanel}<div className="numeric-result"><input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Score 0–180" /></div><div className="score-quick-grid">{[0, 26, 41, 45, 60, 81, 100, 140, 180].map((value) => <button type="button" disabled={disabled || remainingSeconds === 0} key={value} onClick={() => void submitScore({}, value)}>{value}</button>)}</div><button className="button" disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore()}>Aufnahme speichern</button></div>;

  return <div className="visit-entry">{limitPanel}<div className="numeric-result"><input type="number" inputMode="numeric" min="0" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Wert dieser Aufnahme" /></div><div className="result-button-grid compact"><button disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore()}>Aufnahme speichern</button><button disabled={disabled} onClick={() => void onSubmit({ value: score === "" ? 0 : Number(score), finish: true })}>Übung abschließen</button></div></div>;
}
