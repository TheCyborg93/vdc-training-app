"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./training.module.css";

type Player = { id: number; displayName: string };
type Assignment = { boardId: number; position: number; board: { id: number; name: string }; player: Player };
type Session = { id: number; boardId: number; status: string; randomOrderJson: unknown; board: { id: number; name: string } };
type TrainingDay = {
  id: number;
  trainingDate: string;
  status: string;
  trainingPlan: {
    title: string;
    goal: string;
    durationMin: number;
    exercises: { id: number; position: number; durationMin: number; exercise: { id: number; name: string; description: string } }[];
  };
  assignments: Assignment[];
  sessions: Session[];
};

export default function LiveTrainingPage() {
  const [training, setTraining] = useState<TrainingDay | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTraining() {
    const response = await fetch("/api/training/current", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Training konnte nicht geladen werden.");
      return;
    }
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

  const boardPlayers = useMemo(
    () => training?.assignments.filter((item) => item.boardId === boardId).sort((a, b) => a.position - b.position) ?? [],
    [training, boardId],
  );

  const session = training?.sessions.find((item) => item.boardId === boardId);
  const orderIds = Array.isArray(session?.randomOrderJson) ? session.randomOrderJson.map(Number) : [];
  const orderedPlayers = orderIds.length
    ? orderIds.map((id) => boardPlayers.find((item) => item.player.id === id)?.player).filter((item): item is Player => Boolean(item))
    : boardPlayers.map((item) => item.player);

  async function startTraining() {
    if (!training || !boardId) return;
    if (!window.confirm(`Training an ${boards.find((board) => board.id === boardId)?.name ?? "diesem Board"} starten?`)) return;
    setStarting(true);
    setMessage("");
    try {
      const response = await fetch("/api/training/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDayId: training.id, boardId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Start fehlgeschlagen.");
      setMessage("Training wurde gestartet und die Reihenfolge zufällig festgelegt.");
      await loadTraining();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Start fehlgeschlagen.");
    } finally {
      setStarting(false);
    }
  }

  if (!training) {
    return <main className={`${styles.root} dashboard-page`}><section className="card"><h1>Trainingstag</h1><p>{message || "Aktuell ist kein Training veröffentlicht."}</p></section></main>;
  }

  return (
    <main className={`${styles.root} dashboard-page`}>
      <section className="dashboard-heading">
        <div><div className="eyebrow">Live-Training</div><h1>{training.trainingPlan.title}</h1><p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten · {new Date(training.trainingDate).toLocaleString("de-DE")}</p></div>
        <span className="status">{training.status === "RUNNING" ? "Läuft" : "Veröffentlicht"}</span>
      </section>

      <section className="live-training-layout">
        <aside className="card admin-form">
          <label>Board bestätigen
            <select value={boardId ?? ""} onChange={(event) => setBoardId(Number(event.target.value))}>
              {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
          </label>
          <div className="board-confirmation"><small>Ausgewähltes Board</small><strong>{boards.find((board) => board.id === boardId)?.name}</strong><span>{boardPlayers.length} Spieler eingeteilt</span></div>
          <button className="button" disabled={starting || session?.status === "RUNNING"} onClick={startTraining}>{session?.status === "RUNNING" ? "Training läuft" : starting ? "Startet …" : "Training starten"}</button>
          {message && <p className="form-message">{message}</p>}
        </aside>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Board-Gruppe</span><h2>{boards.find((board) => board.id === boardId)?.name}</h2></div></div>
          <div className="live-player-list">
            {orderedPlayers.map((player, index) => <article className="live-player-card" key={player.id}><span>{index + 1}</span><strong>{player.displayName}</strong><small>{session?.status === "RUNNING" ? index === 0 ? "Startspieler" : "Reihenfolge gespeichert" : "Eingeteilt"}</small></article>)}
          </div>

          <div className="section-heading live-exercise-heading"><div><span className="eyebrow">Trainingsablauf</span><h2>{training.trainingPlan.exercises.length} Übungen</h2></div></div>
          <div className="plan-item-list">
            {training.trainingPlan.exercises.map((item, index) => <article className="plan-item" key={item.id}><span className="drag-handle">{index + 1}</span><div><strong>{item.exercise.name}</strong><p>{item.exercise.description}</p></div><span>{item.durationMin} Min.</span></article>)}
          </div>
        </section>
      </section>
    </main>
  );
}
