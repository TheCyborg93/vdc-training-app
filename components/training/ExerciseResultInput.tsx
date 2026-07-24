"use client";

import { useMemo, useState } from "react";

type Props = {
  resultType: string;
  exerciseName: string;
  disabled?: boolean;
  onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
};

export default function ExerciseResultInput({ resultType, exerciseName, disabled = false, onSubmit }: Props) {
  const [visits, setVisits] = useState(["", "", ""]);
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean | null>(null);
  const [checkoutDarts, setCheckoutDarts] = useState("3");
  const [numericValue, setNumericValue] = useState("");
  const isBob27 = useMemo(() => exerciseName.toLowerCase().includes("bob27"), [exerciseName]);

  async function submitScoring() {
    const normalized = visits.filter((item) => item !== "").map(Number);
    if (!normalized.length) return;
    await onSubmit({ visits: normalized });
    setVisits(["", "", ""]);
  }

  if (resultType === "HITS_0_TO_3") {
    return (
      <div className="result-button-grid">
        {[0, 1, 2, 3].map((hits) => (
          <button disabled={disabled} key={hits} onClick={() => void onSubmit({ hits, bob27: isBob27 })}>
            <strong>{hits}</strong><span>{hits === 1 ? "Treffer" : "Treffer"}</span>
          </button>
        ))}
      </div>
    );
  }

  if (resultType === "SCORE_0_TO_180") {
    const total = visits.filter(Boolean).reduce((sum, value) => sum + Number(value), 0);
    return (
      <div className="scoring-input">
        <div className="visit-grid">
          {visits.map((value, index) => (
            <label key={index}>Aufnahme {index + 1}
              <input type="number" min="0" max="180" value={value} onChange={(event) => setVisits((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
            </label>
          ))}
        </div>
        <div className="score-preview"><span>Gesamt</span><strong>{total}</strong><small>Ø {visits.filter(Boolean).length ? (total / visits.filter(Boolean).length).toFixed(2) : "0.00"}</small></div>
        <button className="button" disabled={disabled || visits.every((item) => item === "")} onClick={() => void submitScoring()}>Aufnahmen speichern</button>
      </div>
    );
  }

  if (resultType === "CHECKOUT") {
    return (
      <div className="checkout-input">
        <div className="result-button-grid compact">
          <button className={checkoutSuccess === true ? "selected" : ""} disabled={disabled} onClick={() => setCheckoutSuccess(true)}>Geschafft</button>
          <button className={checkoutSuccess === false ? "selected" : ""} disabled={disabled} onClick={() => setCheckoutSuccess(false)}>Nicht geschafft</button>
        </div>
        <label>Benötigte Darts
          <select value={checkoutDarts} onChange={(event) => setCheckoutDarts(event.target.value)}>{[1,2,3,4,5,6,7,8,9].map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <button className="button" disabled={disabled || checkoutSuccess === null} onClick={() => void onSubmit({ success: checkoutSuccess, darts: Number(checkoutDarts) })}>Checkout speichern</button>
      </div>
    );
  }

  if (resultType === "BOOLEAN") {
    return <div className="result-button-grid compact"><button disabled={disabled} onClick={() => void onSubmit({ success: true })}>Ja</button><button disabled={disabled} onClick={() => void onSubmit({ success: false })}>Nein</button></div>;
  }

  return (
    <div className="numeric-result">
      <input type="number" min="0" value={numericValue} onChange={(event) => setNumericValue(event.target.value)} placeholder="Ergebnis eingeben" />
      <button className="button" disabled={disabled || numericValue === ""} onClick={() => void onSubmit({ value: Number(numericValue) })}>Ergebnis bestätigen</button>
    </div>
  );
}
