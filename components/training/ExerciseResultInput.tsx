"use client";

import { useState } from "react";

type ExerciseState = {
  kind?: string;
  visit?: number;
  score?: number;
  target?: string;
  targetIndex?: number;
  dartsThrown?: number;
  hits?: number;
};

type Props = {
  resultType: string;
  exerciseName: string;
  state?: ExerciseState | null;
  disabled?: boolean;
  onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
};

export default function ExerciseResultInput({ resultType, exerciseName, state, disabled = false, onSubmit }: Props) {
  const [score, setScore] = useState("");
  const [single, setSingle] = useState("0");
  const [double, setDouble] = useState("0");
  const [triple, setTriple] = useState("0");
  const [checkout, setCheckout] = useState(false);
  const kind = state?.kind ?? "CUSTOM";

  async function submitScore(extra: Record<string, unknown> = {}) {
    if (score === "") return;
    await onSubmit({ score: Number(score), ...extra });
    setScore("");
    setCheckout(false);
  }

  if (kind === "BOB27" || kind.startsWith("AROUND_") || kind === "DOUBLES_ROUNDS" || kind === "BULL_ROUNDS" || kind === "HIT_ROUNDS") {
    return (
      <div className="visit-entry">
        <div className="visit-target"><small>Aktuelles Ziel</small><strong>{state?.target ?? exerciseName}</strong><span>Aufnahme {state?.visit ?? 1} · 3 Darts</span></div>
        {kind === "BOB27" && <div className="visit-score"><small>Bob’s-27-Punkte</small><strong>{state?.score ?? 27}</strong></div>}
        <div className="result-button-grid">
          {[0, 1, 2, 3].map((hits) => <button disabled={disabled} key={hits} onClick={() => void onSubmit({ hits })}><strong>{hits}</strong><span>{hits === 1 ? "Treffer" : "Treffer"}</span></button>)}
        </div>
        <p className="visit-help">Trage nur diese Aufnahme ein. Die App berechnet automatisch das nächste Ziel und beendet die Übung erst nach dem letzten Ziel.</p>
      </div>
    );
  }

  if (kind === "SHANGHAI" || kind === "JDC_CHALLENGE") {
    return (
      <div className="visit-entry">
        <div className="visit-target"><small>Aktuelle Zahl</small><strong>{state?.target}</strong><span>Aufnahme {state?.visit ?? 1}</span></div>
        <div className="segment-entry">
          <label>Single<input type="number" min="0" max="3" value={single} onChange={(event) => setSingle(event.target.value)} /></label>
          <label>Double<input type="number" min="0" max="3" value={double} onChange={(event) => setDouble(event.target.value)} /></label>
          <label>Triple<input type="number" min="0" max="3" value={triple} onChange={(event) => setTriple(event.target.value)} /></label>
        </div>
        <button className="button" disabled={disabled} onClick={() => void onSubmit({ single: Number(single), double: Number(double), triple: Number(triple) })}>Aufnahme speichern</button>
      </div>
    );
  }

  if (kind === "X01") {
    return (
      <div className="visit-entry">
        <div className="visit-target"><small>Restscore</small><strong>{state?.score ?? 501}</strong><span>Aufnahme {state?.visit ?? 1}</span></div>
        <div className="numeric-result"><input type="number" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Score dieser Aufnahme" /></div>
        <label className="checkout-confirm"><input type="checkbox" checked={checkout} onChange={(event) => setCheckout(event.target.checked)} /> Mit einem Doppel ausgecheckt</label>
        <button className="button" disabled={disabled || score === ""} onClick={() => void submitScore({ checkout })}>Aufnahme speichern</button>
      </div>
    );
  }

  if (kind === "SCORING" || resultType === "SCORE_0_TO_180") {
    return (
      <div className="visit-entry">
        <div className="visit-target"><small>Einzelaufnahme</small><strong>3 Darts</strong><span>Aufnahme {state?.visit ?? 1}</span></div>
        <div className="numeric-result"><input type="number" min="0" max="180" value={score} onChange={(event) => setScore(event.target.value)} placeholder="0 bis 180" /><button className="button" disabled={disabled || score === ""} onClick={() => void submitScore()}>Aufnahme speichern</button></div>
      </div>
    );
  }

  return (
    <div className="visit-entry">
      <div className="visit-target"><small>Aufnahme {state?.visit ?? 1}</small><strong>{exerciseName}</strong></div>
      <div className="numeric-result"><input type="number" min="0" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Wert dieser Aufnahme" /></div>
      <div className="result-button-grid compact"><button disabled={disabled || score === ""} onClick={() => void submitScore()}>Aufnahme speichern</button><button disabled={disabled} onClick={() => void onSubmit({ value: score === "" ? 0 : Number(score), finish: true })}>Übung abschließen</button></div>
    </div>
  );
}
