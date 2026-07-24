"use client";

import { useEffect, useMemo, useState } from "react";
import ExerciseResultInput from "@/components/training/ExerciseResultInput";
import styles from "./training.module.css";

type Player = { id: number; displayName: string };
type Assignment = { boardId: number; position: number; board: { id: number; name: string }; player: Player };
type Progress = { order: number[]; exerciseIndex: number; playerIndex: number; roundNumber: number };
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
  if (!order.length || !Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber };
}

export default function LiveTrainingPage() {
  const [training, setTraining] = useState<TrainingDay | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTraining() {
    const response = await fetch("/api/training/current", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Training konnte nicht geladen werden."); return; }
    setTraining(data);
    if (data?.assignments?.length && boardId === null) setBoardId(data.assignments[0].boardId);
  }

  useEffect(() => {
    void loadTraining();
    const timer = window.setInterval(() => void loadTraining(), 10000);
    return () => window.clearInterval(timer);
  }, []);

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
  const currentPlanExercise = progress ? training?.trainingPlan.exercises[progress.exerciseIndex] : null;
  const progressPercent = progress && training ? Math.round(((progress.exerciseIndex + (progress.playerIndex + 1) / Math.max(progress.order.length, 1)) / training.trainingPlan.exercises.length) * 100) : 0;

  async function startTraining() {
    if (!training || !boardId) return;
    if (!window.confirm(`Training an ${boards.find((board) => board.id === boardId)?.name ?? "diesem Board"} starten?`)) return;
    setStarting(true); setMessage("");
    try {
      const response = await fetch("/api/training/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingDayId: training.id, boardId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Start fehlgeschlagen.");
      setMessage("Training wurde gestartet.");
      await loadTraining();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Start fehlgeschlagen."); }
    finally { setStarting(false); }
  }

  async function saveResult(value: Record<string, unknown>) {
    if (!session) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/training/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardSessionId: session.id, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ergebnis konnte nicht gespeichert werden.");
      setMessage(data.completed ? "Training an diesem Board abgeschlossen." : "Ergebnis gespeichert. Nächster Spieler ist dran.");
      await loadTraining();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ergebnis konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  if (!training) return <main className={`${styles.root} dashboard-page`}><section className="card"><h1>Trainingstag</h1><p>{message || "Aktuell ist kein Training veröffentlicht."}</p></section></main>;

  return (
    <main className={`${styles.root} dashboard-page`}>
      <section className="dashboard-heading">
        <div><div className="eyebrow">Live-Training</div><h1>{training.trainingPlan.title}</h1><p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten · {new Date(training.trainingDate).toLocaleString("de-DE")}</p></div>
        <span className="status">{training.status === "RUNNING" ? "Läuft" : training.status === "COMPLETED" ? "Beendet" : "Veröffentlicht"}</span>
      </section>

      <section className="live-training-layout">
        <aside className="card admin-form">
          <label>Board bestätigen<select value={boardId ?? ""} onChange={(event) => setBoardId(Number(event.target.value))}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>
          <div className="board-confirmation"><small>Ausgewähltes Board</small><strong>{boards.find((board) => board.id === boardId)?.name}</strong><span>{boardPlayers.length} Spieler eingeteilt</span></div>
          <button className="button" disabled={starting || session?.status === "RUNNING" || session?.status === "COMPLETED"} onClick={startTraining}>{session?.status === "COMPLETED" ? "Training beendet" : session?.status === "RUNNING" ? "Training läuft" : starting ? "Startet …" : "Training starten"}</button>
          {message && <p className="form-message">{message}</p>}
        </aside>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Board-Gruppe</span><h2>{boards.find((board) => board.id === boardId)?.name}</h2></div></div>
          <div className="live-player-list">{orderedPlayers.map((player, index) => <article className={`live-player-card ${currentPlayer?.id === player.id ? "is-current" : ""}`} key={player.id}><span>{index + 1}</span><strong>{player.displayName}</strong><small>{currentPlayer?.id === player.id ? "Jetzt am Zug" : session?.status === "RUNNING" ? "Wartet" : "Eingeteilt"}</small></article>)}</div>

          {session?.status === "RUNNING" && currentPlanExercise && currentPlayer && progress && (
            <section className="result-panel">
              <div className="exercise-progress"><div><span>Übung {progress.exerciseIndex + 1} von {training.trainingPlan.exercises.length}</span><strong>{progressPercent}%</strong></div><div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div></div>
              <div className="eyebrow">Aktuelle Übung</div><h2>{currentPlanExercise.exercise.name}</h2><p>{currentPlanExercise.exercise.description}</p>
              <div className="current-player"><small>Aktueller Spieler</small><strong>{currentPlayer.displayName}</strong></div>
              <ExerciseResultInput resultType={currentPlanExercise.exercise.resultType} exerciseName={currentPlanExercise.exercise.name} disabled={saving} onSubmit={saveResult} />
            </section>
          )}

          <div className="section-heading live-exercise-heading"><div><span className="eyebrow">Trainingsablauf</span><h2>{training.trainingPlan.exercises.length} Übungen</h2></div></div>
          <div className="plan-item-list">{training.trainingPlan.exercises.map((item, index) => <article className={`plan-item ${progress?.exerciseIndex === index ? "is-active-exercise" : ""}`} key={item.id}><span className="drag-handle">{index + 1}</span><div><strong>{item.exercise.name}</strong><p>{item.exercise.description}</p></div><span>{item.durationMin} Min.</span></article>)}</div>
        </section>
      </section>
    </main>
  );
}
