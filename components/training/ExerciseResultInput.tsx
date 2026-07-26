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
    <div className="competition-limit" aria-live="polite">
      <div className="competition-limit-copy">
        <small>{completionMode === "TIME_LIMIT" ? "Verbleibende Zeit" : limitLabel}</small>
        <strong>{completionMode === "TIME_LIMIT" ? formatTime(remainingSeconds ?? completionValue * 60) : `${limitCurrent} / ${completionValue}`}</strong>
        <span>{completionMode === "TIME_LIMIT" ? `${completionValue} Minuten Gesamtzeit` : `${Math.max(0, completionValue - (limitCurrent ?? 0))} verbleibend`}</span>
      </div>
      <div className="competition-limit-track"><span style={{ width: `${completionMode === "TIME_LIMIT" ? Math.max(0, Math.min(100, ((remainingSeconds ?? completionValue * 60) / (completionValue * 60)) * 100)) : limitPercent}%` }} /></div>
    </div>
  ) : null;

  if (kind === "GAME_121") {
    const attemptDarts = state?.attemptDarts ?? 0;
    const dartsRemaining = Math.max(0, 9 - attemptDarts);
    return <div className="competition-engine competition-engine-121">
      <div className="engine-kicker">121 · Neun-Dart-Challenge</div>
      <div className="game121-status">
        <div><small>Restscore</small><strong>{state?.score ?? state?.target ?? 121}</strong></div>
        <div><small>Darts im Versuch</small><strong>{attemptDarts} / 9</strong><span>{dartsRemaining} übrig</span></div>
        <div><small>Gesicherter Wert</small><strong>{state?.baseTarget ?? 121}</strong><span>Rückfallwert</span></div>
      </div>
      <div className="engine-score-entry"><label>Score der Aufnahme<input aria-label="Score der Aufnahme" type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="0–180" /></label></div>
      <div className="score-quick-grid">{[0, 26, 41, 45, 60, 81, 100, 121, 140, 180].map((value) => <button type="button" disabled={disabled} key={value} onClick={() => setScore(String(value))}>{value}</button>)}</div>
      <div className="engine-segmented game121-checkout-row">
        <button type="button" className={!checkout ? "is-active" : ""} disabled={disabled} onClick={() => setCheckout(false)}>Kein Checkout</button>
        <button type="button" className={checkout ? "is-active is-success" : ""} disabled={disabled} onClick={() => setCheckout(true)}>Checkout geschafft</button>
      </div>
      <div className="engine-darts-select"><small>Verwendete Darts</small><div>{[1, 2, 3].map((value) => <button type="button" className={dartsUsed === value ? "is-active" : ""} disabled={disabled || value > dartsRemaining} key={value} onClick={() => setDartsUsed(value)}>{value}</button>)}</div></div>
      <button className="button full engine-submit" disabled={disabled || score === "" || dartsRemaining === 0} onClick={() => void submitScore({ checkout, dartsUsed })}>Aufnahme speichern</button>
    </div>;
  }

  if (kind === "BOB27" || kind.startsWith("AROUND_") || kind === "DOUBLES_ROUNDS" || kind === "BULL_ROUNDS" || kind === "HIT_ROUNDS") {
    const currentScore = state?.score ?? 27;
    const doubleValue = bob27DoubleValue(state);
    const title = kind === "BOB27" ? "Treffer auf das aktuelle Doppel" : kind === "BULL_ROUNDS" ? "Bull-Treffer dieser Aufnahme" : "Treffer dieser Aufnahme";
    return <div className="competition-engine competition-engine-hits">
      {limitPanel}<div className="engine-kicker">{title}</div>
      <div className="engine-hit-grid">{[0, 1, 2, 3].map((hits) => { const preview = hits === 0 ? currentScore - doubleValue : currentScore + hits * doubleValue; return <button disabled={disabled || remainingSeconds === 0} key={hits} onClick={() => void onSubmit({ hits })}><strong>{hits}</strong><span>{hits === 1 ? "Treffer" : "Treffer"}</span>{kind === "BOB27" && <em>Neuer Stand {preview}</em>}</button>; })}</div>
      <p className="engine-help">Die Auswahl wird sofort gespeichert. Danach wechselt die App automatisch zum nächsten Spieler oder Ziel.</p>
    </div>;
  }

  if (kind === "SHANGHAI" || kind === "JDC_CHALLENGE") {
    return <div className="competition-engine competition-engine-segments">
      {limitPanel}<div className="engine-kicker">Treffer auf {state?.target ?? "das aktuelle Ziel"}</div>
      <div className="segment-entry">
        {[{ label: "Single", value: single, set: setSingle }, { label: "Doppel", value: double, set: setDouble }, { label: "Triple", value: triple, set: setTriple }].map((item) => <label key={item.label}><span>{item.label}</span><input type="number" inputMode="numeric" min="0" max="3" value={item.value} onChange={(event) => item.set(event.target.value)} /></label>)}
      </div>
      <button className="button full engine-submit" disabled={disabled || remainingSeconds === 0} onClick={() => void onSubmit({ single: Number(single), double: Number(double), triple: Number(triple) })}>Aufnahme speichern</button>
    </div>;
  }

  if (kind === "X01") {
    return <div className="competition-engine competition-engine-score">
      {limitPanel}<div className="engine-kicker">Score eingeben</div>
      <div className="engine-score-entry"><label>Aufnahme<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="0–180" /></label></div>
      <div className="score-quick-grid">{[0, 26, 41, 45, 60, 81, 100, 140, 180].map((value) => <button type="button" disabled={disabled || remainingSeconds === 0} key={value} onClick={() => setScore(String(value))}>{value}</button>)}</div>
      <button type="button" className={`engine-checkout-toggle ${checkout ? "is-active" : ""}`} disabled={disabled} onClick={() => setCheckout((value) => !value)}><span>{checkout ? "✓" : "○"}</span> Mit Doppel ausgecheckt</button>
      <button className="button full engine-submit" disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore({ checkout })}>Aufnahme speichern</button>
    </div>;
  }

  if (kind === "SCORING" || resultType === "SCORE_0_TO_180") {
    return <div className="competition-engine competition-engine-score">
      {limitPanel}<div className="engine-kicker">Score dieser Aufnahme</div>
      <div className="engine-score-entry"><label>Score<input type="number" inputMode="numeric" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="0–180" /></label></div>
      <div className="score-quick-grid">{[0, 26, 41, 45, 60, 81, 100, 140, 180].map((value) => <button type="button" disabled={disabled || remainingSeconds === 0} key={value} onClick={() => setScore(String(value))}>{value}</button>)}</div>
      <button className="button full engine-submit" disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore()}>Aufnahme speichern</button>
    </div>;
  }

  return <div className="competition-engine competition-engine-custom">
    {limitPanel}<div className="engine-kicker">Ergebnis dieser Aufnahme</div>
    <div className="engine-score-entry"><label>Wert<input type="number" inputMode="numeric" min="0" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Ergebnis" /></label></div>
    <div className="engine-custom-actions"><button className="button" disabled={disabled || score === "" || remainingSeconds === 0} onClick={() => void submitScore()}>Aufnahme speichern</button><button className="button secondary" disabled={disabled} onClick={() => void onSubmit({ value: score === "" ? 0 : Number(score), finish: true })}>Übung abschließen</button></div>
  </div>;
}