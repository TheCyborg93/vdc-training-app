"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./statistics.module.css";

type HistoryItem = { date: string; exercise: string; type: string; score: number | null };
type PlayerStatistics = {
  id: number;
  displayName: string;
  trainingDays: number;
  completedExercises: number;
  overallAverage: number | null;
  personalBest: number | null;
  lastValue: number | null;
  checkout: { attempts: number; successes: number; rate: number | null };
  scoring: { visits: number; average: number | null; highScore: number | null; scores100: number; scores140: number; scores180: number };
  hits: { rounds: number; average: number | null; total: number };
  history: HistoryItem[];
};

function format(value: number | null, suffix = ""): string {
  return value === null ? "–" : `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}${suffix}`;
}

export default function StatisticsPage() {
  const [players, setPlayers] = useState<PlayerStatistics[]>([]);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [message, setMessage] = useState("Statistiken werden geladen …");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/statistics", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Statistiken konnten nicht geladen werden.");
        const loaded = Array.isArray(data.players) ? data.players : [];
        setPlayers(loaded);
        setPlayerId((current) => current ?? loaded[0]?.id ?? null);
        setMessage(loaded.length ? "" : "Noch keine aktiven Spieler vorhanden.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Statistiken konnten nicht geladen werden.");
      }
    }
    void load();
  }, []);

  const selected = useMemo(() => players.find((player) => player.id === playerId) ?? null, [players, playerId]);

  return (
    <main className={`${styles.root} dashboard-page`}>
      <section className="dashboard-heading">
        <div><div className="eyebrow">Version 0.5</div><h1>Spielerstatistik</h1><p>Trainingsergebnisse, Bestwerte und Entwicklung auf einen Blick.</p></div>
      </section>

      <section className="card statistics-select">
        <label>Spieler auswählen
          <select value={playerId ?? ""} onChange={(event) => setPlayerId(Number(event.target.value))}>
            {players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
        </label>
      </section>

      {message && <section className="card"><p>{message}</p></section>}

      {selected && <>
        <section className="stats-row statistics-summary">
          <article><small>Trainingstage</small><strong>{selected.trainingDays}</strong><span>mit gespeichertem Ergebnis</span></article>
          <article><small>Übungen</small><strong>{selected.completedExercises}</strong><span>absolvierte Ergebnisse</span></article>
          <article><small>Gesamtschnitt</small><strong>{format(selected.overallAverage)}</strong><span>über alle bewerteten Übungen</span></article>
          <article><small>Persönlicher Bestwert</small><strong>{format(selected.personalBest)}</strong><span>höchster berechneter Wert</span></article>
        </section>

        <section className="statistics-grid">
          <article className="card statistics-card">
            <div className="eyebrow">Scoring</div><h2>{format(selected.scoring.average)}</h2><p>Durchschnitt aus {selected.scoring.visits} gespeicherten Aufnahmen</p>
            <div className="metric-grid"><span><small>Highscore</small><b>{format(selected.scoring.highScore)}</b></span><span><small>100+</small><b>{selected.scoring.scores100}</b></span><span><small>140+</small><b>{selected.scoring.scores140}</b></span><span><small>180</small><b>{selected.scoring.scores180}</b></span></div>
          </article>

          <article className="card statistics-card">
            <div className="eyebrow">Checkout</div><h2>{format(selected.checkout.rate, " %")}</h2><p>{selected.checkout.successes} erfolgreiche Checks bei {selected.checkout.attempts} Versuchen</p>
            <div className="progress-track"><span style={{ width: `${Math.min(100, selected.checkout.rate ?? 0)}%` }} /></div>
          </article>

          <article className="card statistics-card">
            <div className="eyebrow">Trefferübungen</div><h2>{format(selected.hits.average)}</h2><p>Durchschnittliche Treffer pro Aufnahme</p>
            <div className="metric-grid"><span><small>Runden</small><b>{selected.hits.rounds}</b></span><span><small>Gesamttreffer</small><b>{selected.hits.total}</b></span></div>
          </article>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">Verlauf</span><h2>Letzte Ergebnisse</h2></div></div>
          <div className="history-list">
            {selected.history.length === 0 ? <div className="card"><p>Noch keine Ergebnisse vorhanden.</p></div> : [...selected.history].reverse().map((item, index) => (
              <article className="history-row" key={`${item.date}-${index}`}>
                <div><strong>{item.exercise}</strong><small>{new Date(item.date).toLocaleString("de-DE")}</small></div>
                <span>{item.type.replaceAll("_", " ")}</span>
                <b>{format(item.score)}</b>
              </article>
            ))}
          </div>
        </section>
      </>}
    </main>
  );
}
