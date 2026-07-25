"use client";

import { useEffect, useMemo, useState } from "react";
import ExerciseResultInput from "@/components/training/ExerciseResultInput";
import TrainingReportView, { type TrainingReportData } from "@/components/training/TrainingReportView";
import type { PlayerExerciseState } from "@/lib/exercise-session-engine";

type Player = { id: number; displayName: string };
type Exercise = { id: number; name: string; description: string; defaultMinutes: number; resultType: string; resultConfigJson?: unknown; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number; position?: number };
type Plan = { id: number; playerId: number; title: string; goal: string; durationMin: number; planJson: unknown; updatedAt: string };
type StoredState = { exerciseIndex: number; exerciseState: PlayerExerciseState };
type SavedResult = { id: number; exerciseId: number; roundNumber: number; calculatedScore: number | null; exercise?: { name: string } };
type Session = { id: number; homeTrainingPlanId: number; playerId: number; status: string; exerciseIndex: number; stateJson: unknown; plan?: Plan; results?: SavedResult[] };

type LiveMetric = { label: string; value: string };

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

function liveMetrics(state: PlayerExerciseState, exerciseIndex: number, exerciseCount: number, historyCount: number): LiveMetric[] {
  const data = state as PlayerExerciseState & { kind?: string; score?: number; visit?: number; dartsThrown?: number; hits?: number; target?: string; targetIndex?: number };
  const kind = data.kind ?? "CUSTOM";
  const visit = data.visit ?? 1;
  const darts = data.dartsThrown ?? Math.max(0, visit - 1) * 3;

  if (kind === "BOB27") {
    return [
      { label: "Doppel-Fortschritt", value: `${Math.min(21, (data.targetIndex ?? 0) + 1)} / 21` },
      { label: "Aufnahme", value: String(visit) },
      { label: "Darts", value: String(darts) },
    ];
  }

  if (kind === "X01") {
    return [
      { label: "Restscore", value: String(data.score ?? 501) },
      { label: "Aufnahme", value: String(visit) },
      { label: "Darts", value: String(darts) },
    ];
  }

  if (kind === "SCORING" || kind === "TIME_BASED") {
    return [
      { label: "Aufnahmen", value: String(Math.max(0, visit - 1)) },
      { label: "Darts", value: String(darts) },
      { label: "Gespeichert", value: String(historyCount) },
    ];
  }

  if (kind.startsWith("AROUND_")) {
    return [
      { label: "Zielposition", value: String((data.targetIndex ?? 0) + 1) },
      { label: "Aufnahme", value: String(visit) },
      { label: "Darts", value: String(darts) },
    ];
  }

  if (kind === "SHANGHAI" || kind === "JDC_CHALLENGE") {
    return [
      { label: "Aktuelle Zahl", value: data.target ?? "–" },
      { label: "Gesamtstand", value: String(data.score ?? 0) },
      { label: "Aufnahme", value: String(visit) },
    ];
  }

  return [
    { label: "Übung", value: `${exerciseIndex + 1} / ${exerciseCount}` },
    { label: "Aufnahme", value: String(visit) },
    { label: "Darts", value: String(darts) },
  ];
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
  const [report, setReport] = useState<TrainingReportData | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load(selected?: number | "") {
    const id = selected || playerId;
    const response = await fetch(`/api/home-training${id ? `?playerId=${id}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Heimtraining konnte nicht geladen werden."); return; }
    setPlayers(data.players ?? []);
    setExercises(data.exercises ?? []);
    setPlans(data.plans ?? []);

    if (!id && data.players?.length) {
      const firstId = data.players[0].id;
      setPlayerId(firstId);
      await load(firstId);
      return;
    }

    const active = data.activeSession as Session | null;
    if (active) {
      const stored = readState(active.stateJson);
      const plan = (data.plans ?? []).find((item: Plan) => item.id === active.homeTrainingPlanId) ?? active.plan ?? null;
      setSession(active);
      setActivePlan(plan);
      setHistory(active.results ?? []);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setRunning(active.status === "RUNNING");
      setMessage(active.status === "PAUSED" ? "Dein pausiertes Training ist gespeichert." : "Dein laufendes Training wurde wiederhergestellt.");
    } else {
      setSession(null); setActivePlan(null); setHistory([]); setRunning(false); setExerciseState(null); setExerciseIndex(0);
    }
  }

  useEffect(() => { void load(); }, []);

  const planItems = useMemo(() => activePlan ? readItems(activePlan.planJson) : [], [activePlan]);
  const currentItem = planItems[exerciseIndex];
  const currentExercise = exercises.find((exercise) => exercise.id === Number(currentItem?.exerciseId));
  const selectedPlayer = players.find((player) => player.id === playerId);
  const progressPercent = Math.round(((exerciseIndex + 1) / Math.max(planItems.length, 1)) * 100);
  const focusActive = Boolean(activePlan && session && currentExercise && exerciseState);

  async function createOwnPlan() {
    if (!playerId) return;
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) { setMessage("Für dieses Ziel sind noch keine Übungen verfügbar."); return; }
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
    const response = await fetch("/api/home-training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, title: `${goal}-Heimtraining · ${duration} Minuten`, goal, durationMin: duration, items }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Plan konnte nicht erstellt werden."); return; }
    setMessage("Dein Heimtrainingsplan wurde erstellt.");
    await load(playerId);
  }

  async function startPlan(plan: Plan) {
    if (!playerId) return;
    setSaving(true); setMessage(""); setReport(null);
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", planId: plan.id, playerId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Heimtraining konnte nicht gestartet werden.");
      setActivePlan(plan); setSession(data.session); setHistory(data.session.results ?? []);
      const stored = readState(data.session.stateJson);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setRunning(data.session.status === "RUNNING");
      setMessage(data.resumed ? "Training fortgesetzt." : "Training gestartet.");
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
      if (action === "finish" && data.report) {
        setReport(data.report as TrainingReportData);
        setMessage("");
      } else {
        setMessage(action === "pause" ? "Training pausiert und gespeichert." : action === "resume" ? "Training fortgesetzt." : "Training abgeschlossen.");
      }
      if (action === "cancel") await load(playerId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function undoLastVisit() {
    if (!session || history.length === 0) return;
    if (!window.confirm("Die letzte Aufnahme wirklich rückgängig machen?")) return;
    setSaving(true); setMessage(""); setReport(null);
    try {
      const response = await fetch("/api/home-training/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", sessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aufnahme konnte nicht rückgängig gemacht werden.");
      setSession(data.session);
      const stored = readState(data.state);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      setHistory((current) => current.filter((item) => item.id !== data.undoneResultId));
      setRunning(true);
      setMessage("Letzte Aufnahme wurde zurückgenommen.");
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
      setSession(data.session);
      setHistory((current) => [...current, data.result]);
      const stored = readState(data.state);
      if (stored) { setExerciseIndex(stored.exerciseIndex); setExerciseState(stored.exerciseState); }
      if (data.completed && data.report) {
        setRunning(false);
        setReport(data.report as TrainingReportData);
        setMessage("");
      } else if (data.exerciseCompleted) {
        setMessage("Übung abgeschlossen. Die nächste Übung startet direkt.");
      } else {
        setMessage(`Gespeichert. Weiter mit ${stored?.exerciseState.target ?? `Aufnahme ${stored?.exerciseState.visit ?? ""}`}.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aufnahme konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  if (report) {
    return <div className="training-focus-overlay"><TrainingReportView report={report} onClose={() => { setReport(null); void load(playerId); }} /></div>;
  }

  if (focusActive && activePlan && session && currentExercise && exerciseState) {
    const metrics = liveMetrics(exerciseState, exerciseIndex, planItems.length, history.length);
    const state = exerciseState as PlayerExerciseState & { score?: number; visit?: number; target?: string; dartsThrown?: number };

    return (
      <div className="training-focus-overlay result-grid-overlay">
        <main className="training-result-shell">
          <header className="training-result-header">
            <div>
              <small>Heimtraining · Übung {exerciseIndex + 1} von {planItems.length}</small>
              <strong>{currentExercise.name}</strong>
            </div>
            <div className="competition-header-actions">
              <span>{progressPercent}%</span>
              <button disabled={saving} onClick={() => void sessionAction("finish")}>Beenden</button>
            </div>
          </header>

          <section className="training-result-grid">
            <article className="result-grid-score">
              <small>Aktueller Punktestand</small>
              <strong>{state.score ?? "–"}</strong>
              <span>Aufnahme {state.visit ?? 1}</span>
            </article>

            <article className="result-grid-target">
              <small>Aktuelles Ziel</small>
              <strong>{state.target ?? currentExercise.name}</strong>
              <span>{state.dartsThrown ?? 0} Darts gespielt</span>
            </article>

            <article className="result-grid-player">
              <small>Wer ist dran?</small>
              <strong>{selectedPlayer?.displayName ?? "Spieler"}</strong>
              <span>{session.status === "PAUSED" ? "Training pausiert" : "Du bist am Zug"}</span>
            </article>

            <article className="result-grid-free competition-live-panel">
              <div className="competition-live-heading">
                <div><small>Übung</small><strong>{currentExercise.name}</strong></div>
                <span>{activePlan.goal}</span>
              </div>
              <div className="competition-live-metrics">
                {metrics.map((metric) => <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></div>)}
              </div>
              <div className="result-grid-progress"><span style={{ width: `${progressPercent}%` }} /></div>
            </article>

            <section className="result-grid-engine">
              {running ? (
                <ExerciseResultInput resultType={currentExercise.resultType} exerciseName={currentExercise.name} state={exerciseState} disabled={saving} onSubmit={saveVisit} />
              ) : (
                <div className="result-grid-paused"><strong>Training pausiert</strong><span>Der aktuelle Stand ist sicher in der Datenbank gespeichert.</span></div>
              )}
            </section>

            <footer className="result-grid-undo competition-control-row">
              <button className="button secondary" disabled={saving || history.length === 0} onClick={() => void undoLastVisit()}>Letzte Aufnahme rückgängig</button>
              {running
                ? <button className="button" disabled={saving} onClick={() => void sessionAction("pause")}>Training pausieren</button>
                : <button className="button" disabled={saving} onClick={() => void sessionAction("resume")}>Training fortsetzen</button>}
              {message && <p className="form-message">{message}</p>}
            </footer>
          </section>
        </main>
      </div>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading"><div><div className="eyebrow">Spielerbereich</div><h1>Heimtraining</h1><p>Dein Trainingsplan, deine Aufnahmen und dein Fortschritt werden direkt aus der Datenbank geladen.</p></div></section>
      <section className="club-panel admin-form" style={{ marginBottom: 24 }}><label>Spieler<select value={playerId} onChange={(event) => { const id = Number(event.target.value); setPlayerId(id); setReport(null); void load(id); }}>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label></section>
      <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Meine Pläne</span><h2>{plans.length} verfügbar</h2></div></div><div className="saved-plan-grid">{plans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.goal}</span><h3>{plan.title}</h3><p>{plan.durationMin} Minuten · {readItems(plan.planJson).length} Übungen</p><button className="button full" disabled={saving} onClick={() => void startPlan(plan)}>Training starten</button></article>)}</div></section>
      {plans.length === 0 && <section className="club-panel admin-form"><div className="section-heading"><div><span className="eyebrow">Kein Plan vorhanden</span><h2>Eigenen Plan erstellen</h2></div></div><label>Ziel<select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label><label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[30,45,60,75,90].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label><button className="button" onClick={createOwnPlan}>Plan erstellen lassen</button></section>}
      {message && <p className="form-message" style={{ marginTop: 18 }}>{message}</p>}
    </main>
  );
}
