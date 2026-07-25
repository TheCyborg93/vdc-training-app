"use client";

import { useEffect, useMemo, useState } from "react";
import ExerciseResultInput from "@/components/training/ExerciseResultInput";
import TrainingReportView, { type TrainingReportData } from "@/components/training/TrainingReportView";
import styles from "./training.module.css";

type Player = { id: number; displayName: string };
type Assignment = { boardId: number; position: number; board: { id: number; name: string }; player: Player };
type ExerciseState = { kind?: string; visit?: number; score?: number; target?: string; targetIndex?: number; dartsThrown?: number; hits?: number; completed?: boolean };
type Progress = { order: number[]; exerciseIndex: number; playerIndex: number; roundNumber: number; playerStates?: Record<string, ExerciseState> };
type Session = { id: number; boardId: number; status: string; randomOrderJson: unknown; board: { id: number; name: string } };
type PlanExercise = { id: number; position: number; durationMin: number; exercise: { id: number; name: string; description: string; resultType: string } };
type TrainingDay = { id: number; trainingDate: string; status: string; trainingPlan: { title: string; goal: string; durationMin: number; exercises: PlanExercise[] }; assignments: Assignment[]; sessions: Session[] };

function readProgress(value: unknown): Progress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];
  const exerciseIndex = Number(data.exerciseIndex);
  const playerIndex = Number(data.playerIndex);
  const roundNumber = Number(data.roundNumber);
  const playerStates = data.playerStates && typeof data.playerStates === "object" && !Array.isArray(data.playerStates) ? data.playerStates as Record<string, ExerciseState> : {};
  if (!order.length || !Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber, playerStates };
}

export default function LiveTrainingPage() {
  const [training, setTraining] = useState<TrainingDay | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [report, setReport] = useState<TrainingReportData | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTraining(signal?: AbortSignal) {
    const response = await fetch("/api/training/current", { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Training konnte nicht geladen werden."); return; }
    setTraining(data);
    setBoardId((current) => current ?? data?.assignments?.[0]?.boardId ?? null);
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadTraining(controller.signal);
    const refresh = () => {
      if (document.visibilityState === "visible" && !saving && !report) void loadTraining();
    };
    const timer = window.setInterval(refresh, 12000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [saving, report]);

  const boards = useMemo(() => {
    if (!training) return [];
    const unique = new Map<number, { id: number; name: string }>();
    training.assignments.forEach((item) => unique.set(item.board.id, item.board));
    return [...unique.values()];
  }, [training]);

  const boardPlayers = useMemo(() => training?.assignments.filter((item) => item.boardId === boardId).sort((a, b) => a.position - b.position) ?? [], [training, boardId]);
  const session = training?.sessions.find((item) => item.boardId === boardId);
  const progress = readProgress(session?.randomOrderJson);
  const orderedPlayers = progress ? progress.order.map((id) => boardPlayers.find((item) => item.player.id === id)?.player).filter((item): item is Player => Boolean(item)) : boardPlayers.map((item) => item.player);
  const currentPlayer = progress ? orderedPlayers[progress.playerIndex] : null;
  const nextPlayer = progress && orderedPlayers.length > 1 ? orderedPlayers[(progress.playerIndex + 1) % orderedPlayers.length] : null;
  const currentPlanExercise = progress ? training?.trainingPlan.exercises[progress.exerciseIndex] : null;
  const currentExerciseState = currentPlayer && progress?.playerStates ? progress.playerStates[String(currentPlayer.id)] ?? null : null;
  const progressPercent = progress && training ? Math.round(((progress.exerciseIndex + 1) / Math.max(training.trainingPlan.exercises.length, 1)) * 100) : 0;
  const focusActive = Boolean(session && (session.status === "RUNNING" || session.status === "PAUSED") && currentPlanExercise && currentPlayer && progress);

  async function startTraining() {
    if (!training || !boardId) return;
    if (!window.confirm(`Training an ${boards.find((board) => board.id === boardId)?.name ?? "diesem Board"} starten? Die Reihenfolge wird zufällig ausgelost.`)) return;
    setStarting(true); setMessage(""); setReport(null);
    try {
      const response = await fetch("/api/training/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingDayId: training.id, boardId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Start fehlgeschlagen.");
      await loadTraining();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Start fehlgeschlagen."); }
    finally { setStarting(false); }
  }

  async function undoLastResult() {
    if (!session) return;
    if (!window.confirm("Die letzte Aufnahme wirklich rückgängig machen?")) return;
    setSaving(true); setMessage(""); setReport(null);
    try {
      const response = await fetch("/api/training/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", boardSessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aufnahme konnte nicht rückgängig gemacht werden.");
      setMessage("Letzte Aufnahme wurde zurückgenommen.");
      await loadTraining();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Rückgängig fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function saveResult(value: Record<string, unknown>) {
    if (!session) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/training/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardSessionId: session.id, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aufnahme konnte nicht gespeichert werden.");
      if (data.completed && data.report) {
        setReport(data.report as TrainingReportData);
        setMessage("");
      } else if (data.exerciseCompleted) {
        setMessage("Übung abgeschlossen. Die nächste Übung startet mit einer neuen Reihenfolge.");
      } else {
        const following = orderedPlayers.find((player) => player.id === data.nextPlayerId);
        setMessage(`Gespeichert. Jetzt ist ${following?.displayName ?? "der nächste Spieler"} dran.`);
      }
      await loadTraining();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aufnahme konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  if (report) {
    return <div className="training-focus-overlay"><TrainingReportView report={report} onClose={() => setReport(null)} /></div>;
  }

  if (!training) return <main className={`${styles.root} dashboard-page`}><section className="card"><h1>Trainingstag</h1><p>{message || "Aktuell ist kein Training veröffentlicht."}</p></section></main>;

  if (focusActive && currentPlanExercise && currentPlayer && progress && session) {
    return (
      <div className="training-focus-overlay result-grid-overlay">
        <main className="training-result-shell">
          <header className="training-result-header">
            <div>
              <small>{session.board.name} · Übung {progress.exerciseIndex + 1} von {training.trainingPlan.exercises.length}</small>
              <strong>{currentPlanExercise.exercise.name}</strong>
            </div>
            <span>{progressPercent}%</span>
          </header>

          <section className="training-result-grid">
            <article className="result-grid-score">
              <small>Aktueller Punktestand</small>
              <strong>{currentExerciseState?.score ?? "–"}</strong>
              <span>Aufnahme {currentExerciseState?.visit ?? 1}</span>
            </article>

            <article className="result-grid-target">
              <small>Aktuelles Ziel</small>
              <strong>{currentExerciseState?.target ?? currentPlanExercise.exercise.name}</strong>
              <span>{currentExerciseState?.dartsThrown ?? 0} Darts gespielt</span>
            </article>

            <article className="result-grid-player">
              <small>Wer ist dran?</small>
              <strong>{currentPlayer.displayName}</strong>
              <span>Danach: {nextPlayer?.displayName ?? "–"}</span>
            </article>

            <article className="result-grid-free">
              <div>
                <small>Übung</small>
                <strong>{currentPlanExercise.exercise.name}</strong>
                <p>{currentPlanExercise.exercise.description}</p>
              </div>
              <div className="result-grid-progress">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </article>

            <section className="result-grid-engine">
              {session.status === "RUNNING" ? (
                <ExerciseResultInput resultType={currentPlanExercise.exercise.resultType} exerciseName={currentPlanExercise.exercise.name} state={currentExerciseState} disabled={saving} onSubmit={saveResult} />
              ) : (
                <div className="result-grid-paused"><strong>Training pausiert</strong><span>Die Eingabe ist aktuell gesperrt.</span></div>
              )}
            </section>

            <footer className="result-grid-undo">
              <button className="button secondary" disabled={saving} onClick={() => void undoLastResult()}>Letzte Aufnahme rückgängig machen</button>
              {message && <p className="form-message">{message}</p>}
            </footer>
          </section>
        </main>
      </div>
    );
  }

  return (
    <main className={`${styles.root} dashboard-page`}>
      <section className="dashboard-heading"><div><div className="eyebrow">Trainingstag</div><h1>{training.trainingPlan.title}</h1><p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten · {new Date(training.trainingDate).toLocaleString("de-DE")}</p></div><span className="status">{training.status === "RUNNING" ? "Läuft" : training.status === "COMPLETED" ? "Beendet" : "Bereit"}</span></section>
      <section className="live-training-layout">
        <aside className="card admin-form">
          <label>Board bestätigen<select value={boardId ?? ""} onChange={(event) => { setBoardId(Number(event.target.value)); setReport(null); }}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>
          <div className="board-confirmation"><small>Ausgewähltes Board</small><strong>{boards.find((board) => board.id === boardId)?.name}</strong><span>{boardPlayers.length} Spieler eingeteilt</span></div>
          <button className="button full" disabled={starting || session?.status === "RUNNING" || session?.status === "COMPLETED"} onClick={startTraining}>{session?.status === "COMPLETED" ? "Training beendet" : starting ? "Startet …" : "Training starten"}</button>
          {message && <p className="form-message">{message}</p>}
        </aside>
        <section className="club-panel">
          <div className="section-heading"><div><span className="eyebrow">Board-Zuteilung</span><h2>{boards.find((board) => board.id === boardId)?.name}</h2></div></div>
          <div className="live-player-list">{boardPlayers.map((item, index) => <article className="live-player-card" key={item.player.id}><span>{index + 1}</span><strong>{item.player.displayName}</strong><small>Bereit</small></article>)}</div>
        </section>
      </section>
    </main>
  );
}
