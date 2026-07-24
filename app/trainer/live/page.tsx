"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./trainer-live.module.css";

type Player = { id: number; displayName: string };
type LiveBoard = {
  id: number;
  board: { id: number; name: string };
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  players: Player[];
  currentPlayer: Player | null;
  currentExercise: { id: number; name: string; description: string } | null;
  exerciseIndex: number;
  totalExercises: number;
  progressPercent: number;
  resultCount: number;
};
type LiveTraining = {
  id: number;
  trainingDate: string;
  status: string;
  trainingPlan: { title: string; goal: string; durationMin: number };
  boards: LiveBoard[];
};

function statusLabel(status: string) {
  if (status === "RUNNING") return "Läuft";
  if (status === "COMPLETED") return "Beendet";
  if (status === "PAUSED") return "Pausiert";
  return "Wartet";
}

export default function TrainerLivePage() {
  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadLiveData() {
    try {
      const response = await fetch("/api/trainer/live", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Live-Daten konnten nicht geladen werden.");
      setTraining(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live-Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveData();
    const timer = window.setInterval(() => void loadLiveData(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const boards = training?.boards ?? [];
    return {
      running: boards.filter((board) => board.status === "RUNNING").length,
      waiting: boards.filter((board) => board.status === "NOT_STARTED").length,
      completed: boards.filter((board) => board.status === "COMPLETED").length,
      results: boards.reduce((sum, board) => sum + board.resultCount, 0),
    };
  }, [training]);

  if (loading) {
    return <main className={`${styles.root} dashboard-page`}><section className="card"><h1>Live-Training</h1><p>Live-Daten werden geladen …</p></section></main>;
  }

  if (!training) {
    return <main className={`${styles.root} dashboard-page`}><section className="card"><div className="eyebrow">Trainerbereich</div><h1>Kein Live-Training</h1><p>{message || "Aktuell ist kein Trainingstag veröffentlicht oder gestartet."}</p></section></main>;
  }

  return (
    <main className={`${styles.root} dashboard-page`}>
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">Trainer Live</div>
          <h1>{training.trainingPlan.title}</h1>
          <p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten · {new Date(training.trainingDate).toLocaleString("de-DE")}</p>
        </div>
        <span className="status">Aktualisierung alle 5 Sekunden</span>
      </section>

      <section className="stats-row">
        <article><small>Boards laufen</small><strong>{summary.running}</strong><span>Aktive Gruppen</span></article>
        <article><small>Boards warten</small><strong>{summary.waiting}</strong><span>Noch nicht gestartet</span></article>
        <article><small>Boards fertig</small><strong>{summary.completed}</strong><span>Training beendet</span></article>
        <article><small>Ergebnisse</small><strong>{summary.results}</strong><span>Gespeicherte Einträge</span></article>
      </section>

      {message && <p className="form-message">{message}</p>}

      <section className="trainer-live-grid">
        {training.boards.map((board) => (
          <article className={`trainer-live-card status-${board.status.toLowerCase()}`} key={board.id}>
            <div className="trainer-live-top">
              <div>
                <span className="eyebrow">{board.board.name}</span>
                <h2>{statusLabel(board.status)}</h2>
              </div>
              <span className="status">{board.exerciseIndex + (board.status === "COMPLETED" ? 0 : 1)} / {board.totalExercises}</span>
            </div>

            <div className="trainer-progress"><span style={{ width: `${board.progressPercent}%` }} /></div>
            <div className="trainer-progress-copy"><span>{board.progressPercent}%</span><span>{board.resultCount} Ergebnisse</span></div>

            <div className="trainer-current">
              <small>Aktuelle Übung</small>
              <strong>{board.currentExercise?.name ?? (board.status === "COMPLETED" ? "Training abgeschlossen" : "Noch nicht gestartet")}</strong>
              {board.currentExercise?.description && <p>{board.currentExercise.description}</p>}
            </div>

            <div className="trainer-current-player">
              <small>Aktueller Spieler</small>
              <strong>{board.currentPlayer?.displayName ?? "—"}</strong>
            </div>

            <div className="trainer-player-list">
              {board.players.map((player) => (
                <span className={board.currentPlayer?.id === player.id ? "is-current" : ""} key={player.id}>{player.displayName}</span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
