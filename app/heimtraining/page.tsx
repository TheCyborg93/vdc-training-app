"use client";

import { useEffect, useMemo, useState } from "react";

type Player = { id: number; displayName: string };
type Exercise = { id: number; name: string; description: string; defaultMinutes: number; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number; position?: number };
type Plan = { id: number; playerId: number; title: string; goal: string; durationMin: number; planJson: unknown; updatedAt: string };

const goals = ["Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konstanz", "Wurftechnik", "Matchtraining"];

function readItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item as PlanItem).filter((item) => Number.isInteger(Number(item.exerciseId)));
}

export default function HomeTrainingPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [playerId, setPlayerId] = useState<number | "">("");
  const [goal, setGoal] = useState("Scoring");
  const [duration, setDuration] = useState(45);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function load(selected?: number | "") {
    const id = selected || playerId;
    const response = await fetch(`/api/home-training${id ? `?playerId=${id}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Heimtraining konnte nicht geladen werden.");
      return;
    }
    setPlayers(data.players ?? []);
    setExercises(data.exercises ?? []);
    setPlans(data.plans ?? []);
    if (!id && data.players?.length) {
      const firstId = data.players[0].id;
      setPlayerId(firstId);
      await load(firstId);
    }
  }

  useEffect(() => { void load(); }, []);

  const planItems = useMemo(() => activePlan ? readItems(activePlan.planJson) : [], [activePlan]);
  const currentItem = planItems[exerciseIndex];
  const currentExercise = exercises.find((exercise) => exercise.id === Number(currentItem?.exerciseId));

  async function createOwnPlan() {
    if (!playerId) return;
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) {
      setMessage("Für dieses Ziel sind noch keine Übungen verfügbar.");
      return;
    }
    const items: PlanItem[] = [];
    let remaining = duration;
    let index = 0;
    while (remaining > 0 && index < pool.length * 4) {
      const exercise = pool[index % pool.length];
      const minutes = Math.min(exercise.defaultMinutes, remaining);
      items.push({ exerciseId: exercise.id, durationMin: minutes, position: index });
      remaining -= minutes;
      index += 1;
    }
    const response = await fetch("/api/home-training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, title: `${goal}-Heimtraining · ${duration} Minuten`, goal, durationMin: duration, items }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Plan konnte nicht erstellt werden.");
      return;
    }
    setMessage("Dein Heimtrainingsplan wurde erstellt.");
    await load(playerId);
  }

  function nextExercise() {
    if (exerciseIndex + 1 >= planItems.length) {
      setRunning(false);
      setExerciseIndex(0);
      setMessage("Heimtraining abgeschlossen. Stark gemacht!");
      return;
    }
    setExerciseIndex((current) => current + 1);
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div><div className="eyebrow">Spielerbereich</div><h1>Heimtraining</h1><p>Wähle deinen Spieler und starte deinen persönlichen Plan.</p></div>
      </section>

      <section className="card admin-form" style={{ marginBottom: 24 }}>
        <label>Spieler
          <select value={playerId} onChange={(event) => { const id = Number(event.target.value); setPlayerId(id); setActivePlan(null); setRunning(false); void load(id); }}>
            {players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
        </label>
      </section>

      {running && activePlan && currentExercise ? (
        <section className="result-panel">
          <div className="eyebrow">Übung {exerciseIndex + 1} von {planItems.length}</div>
          <h2>{currentExercise.name}</h2>
          <p>{currentExercise.description}</p>
          <div className="plan-duration is-valid"><strong>{currentItem.durationMin} Minuten</strong><span>{Math.round((exerciseIndex / planItems.length) * 100)} % abgeschlossen</span></div>
          <div className="actions">
            <button className="button" onClick={nextExercise}>{exerciseIndex + 1 === planItems.length ? "Training abschließen" : "Übung erledigt"}</button>
            <button className="button secondary" onClick={() => setRunning(false)}>Pause</button>
          </div>
        </section>
      ) : (
        <>
          <section className="section-block">
            <div className="section-heading"><div><span className="eyebrow">Meine Pläne</span><h2>{plans.length} verfügbar</h2></div></div>
            <div className="saved-plan-grid">
              {plans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.goal}</span><h3>{plan.title}</h3><p>{plan.durationMin} Minuten · {readItems(plan.planJson).length} Übungen</p><button className="button full" onClick={() => { setActivePlan(plan); setExerciseIndex(0); setRunning(true); }}>Training starten</button></article>)}
            </div>
          </section>
          {plans.length === 0 && (
            <section className="card admin-form">
              <div className="section-heading"><div><span className="eyebrow">Kein Plan vorhanden</span><h2>Eigenen Plan erstellen</h2></div></div>
              <label>Ziel<select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[30,45,60,75,90].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label>
              <button className="button" onClick={createOwnPlan}>Plan erstellen lassen</button>
            </section>
          )}
        </>
      )}
      {message && <p className="form-message" style={{ marginTop: 18 }}>{message}</p>}
    </main>
  );
}
