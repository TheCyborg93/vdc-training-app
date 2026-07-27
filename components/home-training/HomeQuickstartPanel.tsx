"use client";

import { useMemo, useState } from "react";
import { useHomeInsights } from "./HomeInsightsProvider";

const BUDGETS = [30, 45, 60, 90];

export default function HomeQuickstartPanel() {
  const { playerId, data: insights, loading, error: insightsError } = useHomeInsights();
  const data = insights?.quickstart ?? null;
  const [budget, setBudget] = useState(45);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [localError, setLocalError] = useState("");

  const bestPlan = useMemo(() => {
    if (!data?.recommendations.length) return null;
    return [...data.recommendations].sort((a, b) => {
      const priority = Number(b.priority) - Number(a.priority);
      if (priority) return priority;
      return Math.abs(a.durationMin - budget) - Math.abs(b.durationMin - budget);
    })[0] ?? null;
  }, [data, budget]);

  async function start(plan: NonNullable<typeof bestPlan>) {
    if (!playerId || data?.activeSession) return;
    setStartingId(plan.id);
    setLocalError("");
    try {
      const response = await fetch("/api/home-training/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", planId: plan.id, playerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Training konnte nicht gestartet werden.");
      window.location.reload();
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Training konnte nicht gestartet werden.");
      setStartingId(null);
    }
  }

  if (!playerId) return null;
  const error = localError || insightsError;

  return (
    <section className="home-quickstart-shell" aria-label="Intelligenter Trainingsschnellstart">
      <div className="home-quickstart-heading">
        <div><span>Smart Start</span><h2>Deine nächste Einheit</h2><p>Zeit wählen, Empfehlung prüfen und direkt loslegen.</p></div>
        {data && <div className="home-quickstart-week"><strong>{data.weekProgress}/{data.weeklyTarget}</strong><span>Einheiten diese Woche</span></div>}
      </div>

      {loading ? (
        <div className="home-quickstart-state">Empfehlung wird berechnet …</div>
      ) : error && !data ? (
        <div className="home-quickstart-state is-error">{error}</div>
      ) : data ? (
        <div className="home-quickstart-grid">
          <article className="home-quickstart-primary">
            <div className="home-quickstart-budget">
              <small>Wie viel Zeit hast du?</small>
              <div>{BUDGETS.map((minutes) => <button key={minutes} className={budget === minutes ? "is-active" : ""} onClick={() => setBudget(minutes)}>{minutes} Min.</button>)}</div>
            </div>

            {data.activeSession ? (
              <div className="home-quickstart-active"><span>Einheit bereits aktiv</span><h3>Setze zuerst dein aktuelles Training fort.</h3><p>Der gespeicherte Fortschritt bleibt erhalten.</p></div>
            ) : bestPlan ? (
              <div className="home-quickstart-recommendation">
                <span>Empfohlen für heute · {data.priorityFocus}</span>
                <h3>{bestPlan.title}</h3>
                <p>{bestPlan.exerciseCount} Übungen · {bestPlan.durationMin} Minuten · Schwerpunkt {bestPlan.goal}</p>
                <button disabled={startingId !== null} onClick={() => void start(bestPlan)}>{startingId === bestPlan.id ? "Wird gestartet …" : "Empfehlung starten"}</button>
              </div>
            ) : (
              <div className="home-quickstart-active"><span>Noch kein passender Plan</span><h3>Erstelle zuerst einen persönlichen Trainingsplan.</h3></div>
            )}
            {error && <p className="home-quickstart-error">{error}</p>}
          </article>

          <article className="home-quickstart-weekplan">
            <div><small>Wochenplanung</small><h3>{data.weekProgress >= data.weeklyTarget ? "Rhythmus geschafft" : "Noch offene Einheiten"}</h3></div>
            {data.suggestedDays.length ? (
              <div className="home-quickstart-days">
                {data.suggestedDays.map((day) => <div key={day.date}><span>{day.label}</span><strong>{day.focus}</strong><small>empfohlener Schwerpunkt</small></div>)}
              </div>
            ) : <p>Dein Wochenziel ist erreicht. Eine kurze Ergänzungseinheit ist optional.</p>}
          </article>

          <article className="home-quickstart-options">
            <div><small>Alternativen</small><h3>Weitere passende Pläne</h3></div>
            <div>
              {data.recommendations.filter((plan) => plan.id !== bestPlan?.id).slice(0, 3).map((plan) => (
                <button key={plan.id} disabled={Boolean(data.activeSession) || startingId !== null} onClick={() => void start(plan)}>
                  <span>{plan.goal}</span><strong>{plan.title}</strong><small>{plan.durationMin} Min. · {plan.exerciseCount} Übungen</small>
                </button>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
