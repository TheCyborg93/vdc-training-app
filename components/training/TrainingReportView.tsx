"use client";

import { useMemo, useState } from "react";

type Metric = { label: string; value: string; detail?: string };
type ExerciseSummary = { title: string; kind: string; highlight: string; metrics: Metric[] };
type PlayerReport = { playerId: number; playerName: string; exercises: ExerciseSummary[]; feedback: string };
export type TrainingReportData = { title: string; completedAt: string; players: PlayerReport[] };

export default function TrainingReportView({ report, onClose }: { report: TrainingReportData; onClose?: () => void }) {
  const [playerId, setPlayerId] = useState(report.players[0]?.playerId ?? 0);
  const player = useMemo(
    () => report.players.find((item) => item.playerId === playerId) ?? report.players[0],
    [report.players, playerId],
  );

  if (!player) return null;

  return (
    <section className="training-report">
      <header className="training-report__header">
        <div>
          <span className="eyebrow">Training abgeschlossen</span>
          <h1>{report.title}</h1>
          <p>{new Date(report.completedAt).toLocaleString("de-DE")}</p>
        </div>
        {onClose ? <button className="button secondary" onClick={onClose}>Schließen</button> : null}
      </header>

      {report.players.length > 1 ? (
        <nav className="training-report__players" aria-label="Spieler auswählen">
          {report.players.map((item) => (
            <button
              key={item.playerId}
              className={item.playerId === player.playerId ? "is-active" : ""}
              onClick={() => setPlayerId(item.playerId)}
            >
              {item.playerName}
            </button>
          ))}
        </nav>
      ) : null}

      <article className="training-report__coach">
        <span>Automatisches Coach-Feedback</span>
        <h2>{player.playerName}</h2>
        <p>{player.feedback}</p>
      </article>

      <div className="training-report__grid">
        {player.exercises.map((exercise, index) => (
          <article className="training-report__exercise" key={`${exercise.title}-${index}`}>
            <div className="training-report__exercise-head">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{exercise.kind.replaceAll("_", " ")}</small>
                <h3>{exercise.title}</h3>
              </div>
            </div>
            <p className="training-report__highlight">{exercise.highlight}</p>
            <div className="training-report__metrics">
              {exercise.metrics.map((metric) => (
                <div key={metric.label}>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                  {metric.detail ? <span>{metric.detail}</span> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
