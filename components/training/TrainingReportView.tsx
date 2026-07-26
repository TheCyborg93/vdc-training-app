"use client";

import { useMemo, useState } from "react";

type Metric = { label: string; value: string; detail?: string };
type ExerciseSummary = { title: string; kind: string; highlight: string; metrics: Metric[] };
type PlayerReport = { playerId: number; playerName: string; exercises: ExerciseSummary[]; feedback: string };
export type TrainingReportData = { title: string; completedAt: string; players: PlayerReport[] };

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function TrainingReportView({ report, onClose }: { report: TrainingReportData; onClose?: () => void }) {
  const [playerId, setPlayerId] = useState(report.players[0]?.playerId ?? 0);
  const player = useMemo(() => report.players.find((item) => item.playerId === playerId) ?? report.players[0], [report.players, playerId]);
  const metricCount = player?.exercises.reduce((sum, exercise) => sum + exercise.metrics.length, 0) ?? 0;

  if (!player) return null;

  return (
    <section className="training-report report-premium">
      <header className="report-premium-header">
        <div className="report-premium-title">
          <span className="eyebrow">Training abgeschlossen</span>
          <h1>{report.title}</h1>
          <p>{new Date(report.completedAt).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })}</p>
        </div>
        <div className="report-premium-summary">
          <span><small>Spieler</small><strong>{report.players.length}</strong></span>
          <span><small>Übungen</small><strong>{player.exercises.length}</strong></span>
          <span><small>Kennzahlen</small><strong>{metricCount}</strong></span>
          {onClose ? <button className="button secondary" onClick={onClose}>Bericht schließen</button> : null}
        </div>
      </header>

      {report.players.length > 1 ? (
        <nav className="report-player-switch" aria-label="Spieler auswählen">
          {report.players.map((item) => (
            <button key={item.playerId} className={item.playerId === player.playerId ? "is-active" : ""} onClick={() => setPlayerId(item.playerId)}>
              <span>{initials(item.playerName)}</span><strong>{item.playerName}</strong><small>{item.exercises.length} Übungen</small>
            </button>
          ))}
        </nav>
      ) : null}

      <article className="report-coach-card">
        <div className="report-coach-icon">◎</div>
        <div><span>Automatisches Coach-Feedback</span><h2>{player.playerName}</h2><p>{player.feedback}</p></div>
      </article>

      <div className="report-exercise-stack">
        {player.exercises.map((exercise, index) => (
          <article className="report-exercise-card" key={`${exercise.title}-${index}`}>
            <header>
              <span className="report-exercise-number">{String(index + 1).padStart(2, "0")}</span>
              <div><small>{exercise.kind.replaceAll("_", " ")}</small><h3>{exercise.title}</h3></div>
            </header>
            <p className="report-exercise-highlight">{exercise.highlight}</p>
            <div className="report-metric-grid">
              {exercise.metrics.map((metric) => (
                <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong>{metric.detail ? <span>{metric.detail}</span> : null}</div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
