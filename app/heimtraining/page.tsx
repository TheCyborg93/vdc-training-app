"use client";

import { useEffect, useMemo, useState } from "react";
import ExerciseResultInput from "@/components/training/ExerciseResultInput";
import type { PlayerExerciseState } from "@/lib/exercise-session-engine";

type Player = { id: number; displayName: string };
type Exercise = { id: number; name: string; description: string; defaultMinutes: number; resultType: string; resultConfigJson?: unknown; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number; position?: number };
type Plan = { id: number; playerId: number; title: string; goal: string; durationMin: number; planJson: unknown; updatedAt: string };
type StoredState = { exerciseIndex: number; exerciseState: PlayerExerciseState };
type SavedResult = { id: number; exerciseId: number; roundNumber: number; calculatedScore: number | null; exercise?: { name: string } };
type Session = { id: number; homeTrainingPlanId: number; playerId: number; status: string; exerciseIndex: number; stateJson: unknown; plan?: Plan; results?: SavedResult[] };

const goals = ["Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konstanz", "Wurftechnik", "Matchtraining"];

function readItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item as PlanItem).filter((item) => Number.isInteger(Number(item.exerciseId)));
}

function readState(value: unknown): StoredState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(Number(data.exerciseIndex)) || !data.exerciseState || typeof data.exerciseState !== "object" || Array.isArray(data.exerciseState)) return null;
  return { exerciseIndex: Number(data.exerciseIndex), exerciseState: data.exerciseState as PlayerExerciseState };
}

export default function HomeTrainingPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [playerId, setPlayerId] = useState<number | "">("");
  const [goal, setGoal] = useState("Scoring");
  const [duration, setDuration] = useState(45);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [exerciseState, setExerciseState] = useState<PlayerExerciseState | null>(null);
  const [history, setHistory] = useState<SavedResult[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load(selected?: number | "") {
    const id = selected || playerId;
    const response = await fetch(`/api/home-training${id ? `?playerId=${id}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Heimtraining konnte nicht geladen werden."); return; }
    setPlayers(data.players ?? []); setExercises(data.exercises ?? []); setPlans(data.plans ?? []);
    if (!id && data.players?.length) { const firstId = data.players[0].id; setPlayerId(firstId); await load(firstId); return; }
    const active = data.activeSession as Session | null;
    if (active) {
      const stored = readState(active.stateJson);
      const plan = (data.plans ?? []).find((item: Plan) => item.id === active.homeTrainingPlanId) ?? active.plan ?? null;
      setSession(active); setActivePlan(plan); setHistory(active.results ?? []);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setRunning(active.status === "RUNNING");
      setMessage(active.status === "PAUSED" ? "Pausiertes Heimtraining gefunden. Du kannst direkt fortsetzen." : "Laufendes Heimtraining wurde wiederhergestellt.");
    } else {
      setSession(null); setActivePlan(null); setHistory([]); setRunning(false); setExerciseState(null); setExerciseIndex(0);
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

  async function startPlan(plan: Plan) {
    if (!playerId) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", planId: plan.id, playerId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Heimtraining konnte nicht gestartet werden.");
      setActivePlan(plan); setSession(data.session); setHistory(data.session.results ?? []);
      const stored = readState(data.session.stateJson);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setRunning(data.session.status === "RUNNING");
      setMessage(data.resumed ? "Vorhandenes Heimtraining fortgesetzt." : "Heimtraining gestartet und in der Datenbank gespeichert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Start fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function sessionAction(action: "pause" | "resume" | "finish" | "cancel") {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
      setSession(data.session);
      setRunning(action === "resume");
      setMessage(action === "pause" ? "Heimtraining pausiert. Dein Stand ist gespeichert." : action === "resume" ? "Heimtraining fortgesetzt." : "Heimtraining abgeschlossen.");
      if (action === "finish" || action === "cancel") await load(playerId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function undoLastVisit() {
    if (!session || history.length === 0) return;
    if (!window.confirm("Die letzte Aufnahme wirklich rückgängig machen? Punktestand und Ziel werden zurückgesetzt.")) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", sessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aufnahme konnte nicht rückgängig gemacht werden.");
      setSession(data.session);
      const stored = readState(data.state);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setHistory((current) => current.filter((item) => item.id !== data.undoneResultId));
      setRunning(true);
      setMessage("Letzte Aufnahme wurde rückgängig gemacht. Punktestand und Ziel wurden wiederhergestellt.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Rückgängig fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function saveVisit(value: Record<string, unknown>) {
    if (!session || !currentExercise || !exerciseState) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "visit", sessionId: session.id, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aufnahme konnte nicht gespeichert werden.");
      setSession(data.session); setHistory((current) => [...current, data.result]);
      const stored = readState(data.state);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      if (data.completed) { setRunning(false); setMessage("Heimtraining vollständig abgeschlossen. Alle Ergebnisse wurden gespeichert."); }
      else if (data.exerciseCompleted) setMessage("Übung abgeschlossen. Die nächste Übung startet automatisch.");
      else setMessage(`Aufnahme gespeichert. Weiter mit ${stored?.exerciseState.target ?? `Aufnahme ${stored?.exerciseState.visit ?? ""}`}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aufnahme konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading"><div><div className="eyebrow">Spielerbereich</div><h1>Heimtraining</h1><p>Jede Aufnahme und dein kompletter Fortschritt werden dauerhaft in Supabase gespeichert.</p></div></section>
      <section className="card admin-form" style={{ marginBottom: 24 }}><label>Spieler<select value={playerId} onChange={(event) => { const id = Number(event.target.value); setPlayerId(id); void load(id); }}>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label></section>

      {activePlan && session && currentExercise && exerciseState ? (
        <section className="result-panel">
          <div className="exercise-progress"><div><span>Übung {exerciseIndex + 1} von {planItems.length}</span><strong>{Math.round((exerciseIndex / Math.max(planItems.length, 1)) * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.round((exerciseIndex / Math.max(planItems.length, 1)) * 100)}%` }} /></div></div>
          <div className="eyebrow">{session.status === "PAUSED" ? "Training pausiert" : "Aktuelle Übung"}</div><h2>{currentExercise.name}</h2><p>{currentExercise.description}</p>
          <div className="current-player"><small>Aufnahme</small><strong>{exerciseState.visit}</strong><span>{exerciseState.target ? `Ziel: ${exerciseState.target}` : "Einzelaufnahme"}{exerciseState.score !== undefined ? ` · Stand: ${exerciseState.score}` : ""}</span></div>
          {running && <ExerciseResultInput resultType={currentExercise.resultType} exerciseName={currentExercise.name} state={exerciseState} disabled={saving} onSubmit={saveVisit} />}
          <div className="actions">
            {running ? <button className="button secondary" disabled={saving} onClick={() => void sessionAction("pause")}>Pause & speichern</button> : <button className="button" disabled={saving} onClick={() => void sessionAction("resume")}>Training fortsetzen</button>}
            <button className="button secondary" disabled={saving || history.length === 0} onClick={() => void undoLastVisit()}>Letzte Aufnahme rückgängig</button>
            <button className="button secondary" disabled={saving} onClick={() => void sessionAction("finish")}>Training beenden</button>
          </div>
          {history.length > 0 && <div className="club-list" style={{ marginTop: 20 }}>{history.filter((item) => item.exerciseId === currentExercise.id).slice(-5).reverse().map((item) => <article key={item.id}><div><strong>Aufnahme {item.roundNumber}</strong><small style={{ display: "block" }}>{item.exercise?.name ?? currentExercise.name}</small></div><span>gespeichert</span><b>{item.calculatedScore ?? "–"}</b></article>)}</div>}
        </section>
      ) : (
        <>
          <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Meine Pläne</span><h2>{plans.length} verfügbar</h2></div></div><div className="saved-plan-grid">{plans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.goal}</span><h3>{plan.title}</h3><p>{plan.durationMin} Minuten · {readItems(plan.planJson).length} Übungen</p><button className="button full" disabled={saving} onClick={() => void startPlan(plan)}>Training starten</button></article>)}</div></section>
          {plans.length === 0 && <section className="card admin-form"><div className="section-heading"><div><span className="eyebrow">Kein Plan vorhanden</span><h2>Eigenen Plan erstellen</h2></div></div><label>Ziel<select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label><label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[30,45,60,75,90].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label><button className="button" onClick={createOwnPlan}>Plan erstellen lassen</button></section>}
        </>
      )}
      {message && <p className="form-message" style={{ marginTop: 18 }}>{message}</p>}
    </main>
  );
}
