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

function bob27DoubleValue(state?: ExerciseState | null): number {
  const index = Number(state?.targetIndex ?? 0);
  return index >= 20 ? 50 : (index + 1) * 2;
}

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
    const currentScore = state?.score ?? 27;
    const doubleValue = bob27DoubleValue(state);

    return (
      <div className="visit-entry">
        {kind === "BOB27" && (
          <div className="bob27-scoreboard" aria-live="polite">
            <div>
              <small>Aktueller Punktestand</small>
              <strong>{currentScore}</strong>
              <span>Startwert 27</span>
            </div>
            <div>
              <small>Aktuelles Ziel</small>
              <strong>{state?.target ?? "D1"}</strong>
              <span>Wert pro Treffer: +{doubleValue}</span>
            </div>
            <div>
              <small>Aufnahme</small>
              <strong>{state?.visit ?? 1}</strong>
              <span>{state?.dartsThrown ?? 0} Darts geworfen</span>
            </div>
          </div>
        )}

        {kind !== "BOB27" && <div className="visit-target"><small>Aktuelles Ziel</small><strong>{state?.target ?? exerciseName}</strong><span>Aufnahme {state?.visit ?? 1} · 3 Darts</span></div>}

        <div className="result-button-grid bob27-buttons">
          {[0, 1, 2, 3].map((hits) => {
            const preview = hits === 0 ? currentScore - doubleValue : currentScore + hits * doubleValue;
            return (
              <button disabled={disabled} key={hits} onClick={() => void onSubmit({ hits })}>
                <strong>{hits}</strong>
                <span>{hits === 1 ? "Treffer" : "Treffer"}</span>
                {kind === "BOB27" && <em>Neuer Stand: {preview}</em>}
              </button>
            );
          })}
        </div>
        <p className="visit-help">Es wird nur diese Aufnahme gespeichert. Die Übung läuft weiter, bis alle Doppel einschließlich Doppel-Bull gespielt wurden oder der Punktestand auf 0 beziehungsweise darunter fällt.</p>
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
