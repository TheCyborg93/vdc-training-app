"use client";

import { useEffect, useMemo, useState } from "react";

type Recommendation = {
  id: number;
  title: string;
  goal: string;
  durationMin: number;
  exerciseCount: number;
  priority: boolean;
};

type QuickstartData = {
  activeSession: { id: number; homeTrainingPlanId: number; status: string } | null;
  priorityFocus: string;
  weekProgress: number;
  weeklyTarget: number;
  recommendations: Recommendation[];
  suggestedDays: { date: string; label: string; focus: string }[];
};

const BUDGETS = [30, 45, 60, 90];

export default function HomeQuickstartPanel() {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [data, setData] = useState<QuickstartData | null>(null);
  const [budget, setBudget] = useState(45);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    function connect() {
      const select = document.querySelector<HTMLSelectElement>("#home-player");
      if (!select) {
        window.setTimeout(connect, 120);
        return;
      }
      const sync = () => {
        const value = Number(select.value);
        if (!cancelled && Number.isInteger(value)) setPlayerId(value);
      };
      sync();
      select.addEventListener("change", sync);
      cleanup = () => select.removeEventListener("change", sync);
    }
    connect();
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/home-training/quickstart?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Schnellstart konnte nicht geladen werden.");
        setData(payload as QuickstartData);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Schnellstart konnte nicht geladen werden.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [playerId]);

  const bestPlan = useMemo(() => {
    if (!data?.recommendations.length) return null;
    return [...data.recommendations].sort((a, b) => {
      const priority = Number(b.priority) - Number(a.priority);
      if (priority) return priority;
      return Math.abs(a.durationMin - budget) - Math.abs(b.durationMin - budget);
    })[0] ?? null;
  }, [data, budget]);

  async function start(plan: Recommendation) {
    if (!playerId || data?.activeSession) return;
    setStartingId(plan.id);
    setError("");
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
      setError(reason instanceof Error ? reason.message : "Training konnte nicht gestartet werden.");
      setStartingId(null);
    }
  }

  if (!playerId) return null;

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
