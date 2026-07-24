"use client";

import { useEffect, useMemo, useState } from "react";
import ExerciseResultInput from "@/components/training/ExerciseResultInput";
import { applyVisit, createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";

type Player = { id: number; displayName: string };
type Exercise = { id: number; name: string; description: string; defaultMinutes: number; resultType: string; resultConfigJson?: unknown; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number; position?: number };
type Plan = { id: number; playerId: number; title: string; goal: string; durationMin: number; planJson: unknown; updatedAt: string };
type VisitHistory = { exerciseId: number; exerciseName: string; visit: number; value: Record<string, unknown>; score: number | null };

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
  const [exerciseState, setExerciseState] = useState<PlayerExerciseState | null>(null);
  const [history, setHistory] = useState<VisitHistory[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load(selected?: number | "") {
    const id = selected || playerId;
    const response = await fetch(`/api/home-training${id ? `?playerId=${id}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Heimtraining konnte nicht geladen werden."); return; }
    setPlayers(data.players ?? []); setExercises(data.exercises ?? []); setPlans(data.plans ?? []);
    if (!id && data.players?.length) { const firstId = data.players[0].id; setPlayerId(firstId); await load(firstId); }
  }

  useEffect(() => { void load(); }, []);

  const planItems = useMemo(() => activePlan ? readItems(activePlan.planJson) : [], [activePlan]);
  const currentItem = planItems[exerciseIndex];
  const currentExercise = exercises.find((exercise) => exercise.id === Number(currentItem?.exerciseId));

  useEffect(() => {
    if (running && currentExercise) setExerciseState(createInitialExerciseState(currentExercise));
  }, [running, exerciseIndex, currentExercise?.id]);

  async function createOwnPlan() {
    if (!playerId) return;
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) { setMessage("Für dieses Ziel sind noch keine Übungen verfügbar."); return; }
    const items: PlanItem[] = []; let remaining = duration; let index = 0;
    while (remaining > 0 && index < pool.length * 4) {
      const exercise = pool[index % pool.length]; const minutes = Math.min(exercise.defaultMinutes, remaining);
      items.push({ exerciseId: exercise.id, durationMin: minutes, position: index }); remaining -= minutes; index += 1;
    }
    const response = await fetch("/api/home-training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, title: `${goal}-Heimtraining · ${duration} Minuten`, goal, durationMin: duration, items }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Plan konnte nicht erstellt werden."); return; }
    setMessage("Dein Heimtrainingsplan wurde erstellt."); await load(playerId);
  }

  function finishExercise() {
    if (exerciseIndex + 1 >= planItems.length) {
      setRunning(false); setExerciseIndex(0); setExerciseState(null); setMessage("Heimtraining abgeschlossen. Stark gemacht!"); return;
    }
    setExerciseIndex((current) => current + 1);
  }

  async function saveVisit(value: Record<string, unknown>) {
    if (!currentExercise || !exerciseState) return;
    setSaving(true); setMessage("");
    try {
      const applied = applyVisit(currentExercise, exerciseState, value);
      setHistory((current) => [...current, { exerciseId: currentExercise.id, exerciseName: currentExercise.name, visit: exerciseState.visit, value: applied.visitValue, score: applied.calculatedScore }]);
      setExerciseState(applied.nextState);
      if (applied.playerFinished) { setMessage(`${currentExercise.name} abgeschlossen.`); window.setTimeout(finishExercise, 500); }
      else setMessage(`Aufnahme ${exerciseState.visit} gespeichert. Weiter mit ${applied.nextState.target ?? `Aufnahme ${applied.nextState.visit}`}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aufnahme konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading"><div><div className="eyebrow">Spielerbereich</div><h1>Heimtraining</h1><p>Jede Aufnahme wird einzeln erfasst und nach den Regeln der Übung ausgewertet.</p></div></section>

      <section className="card admin-form" style={{ marginBottom: 24 }}><label>Spieler<select value={playerId} onChange={(event) => { const id = Number(event.target.value); setPlayerId(id); setActivePlan(null); setRunning(false); void load(id); }}>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label></section>

      {running && activePlan && currentExercise && exerciseState ? (
        <section className="result-panel">
          <div className="exercise-progress"><div><span>Übung {exerciseIndex + 1} von {planItems.length}</span><strong>{Math.round((exerciseIndex / Math.max(planItems.length, 1)) * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.round((exerciseIndex / Math.max(planItems.length, 1)) * 100)}%` }} /></div></div>
          <div className="eyebrow">Aktuelle Übung</div><h2>{currentExercise.name}</h2><p>{currentExercise.description}</p>
          <div className="current-player"><small>Aufnahme</small><strong>{exerciseState.visit}</strong><span>{exerciseState.target ? `Ziel: ${exerciseState.target}` : "Einzelaufnahme"}{exerciseState.score !== undefined ? ` · Stand: ${exerciseState.score}` : ""}</span></div>
          <ExerciseResultInput resultType={currentExercise.resultType} exerciseName={currentExercise.name} state={exerciseState} disabled={saving} onSubmit={saveVisit} />
          <div className="actions"><button className="button secondary" onClick={() => setRunning(false)}>Pause</button><button className="button secondary" onClick={finishExercise}>Übung manuell beenden</button></div>
          {history.length > 0 && <div className="club-list" style={{ marginTop: 20 }}>{history.filter((item) => item.exerciseId === currentExercise.id).slice(-5).reverse().map((item, index) => <article key={`${item.visit}-${index}`}><div><strong>Aufnahme {item.visit}</strong><small style={{ display: "block" }}>{item.exerciseName}</small></div><span>gespeichert</span><b>{item.score ?? "–"}</b></article>)}</div>}
        </section>
      ) : (
        <>
          <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Meine Pläne</span><h2>{plans.length} verfügbar</h2></div></div><div className="saved-plan-grid">{plans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.goal}</span><h3>{plan.title}</h3><p>{plan.durationMin} Minuten · {readItems(plan.planJson).length} Übungen</p><button className="button full" onClick={() => { setActivePlan(plan); setExerciseIndex(0); setHistory([]); setRunning(true); }}>Training starten</button></article>)}</div></section>
          {plans.length === 0 && <section className="card admin-form"><div className="section-heading"><div><span className="eyebrow">Kein Plan vorhanden</span><h2>Eigenen Plan erstellen</h2></div></div><label>Ziel<select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label><label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[30,45,60,75,90].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label><button className="button" onClick={createOwnPlan}>Plan erstellen lassen</button></section>}
        </>
      )}
      {message && <p className="form-message" style={{ marginTop: 18 }}>{message}</p>}
    </main>
  );
}
