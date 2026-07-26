"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./statistics.module.css";

type HistoryItem = { date: string; exercise: string; type: string; score: number | null };
type PlayerStatistics = {
  id: number; displayName: string; trainingDays: number; completedExercises: number; overallAverage: number | null; personalBest: number | null; lastValue: number | null;
  checkout: { attempts: number; successes: number; rate: number | null };
  scoring: { visits: number; average: number | null; highScore: number | null; scores100: number; scores140: number; scores180: number };
  hits: { rounds: number; average: number | null; total: number };
  history: HistoryItem[];
};

function format(value: number | null, suffix = "", digits = 2): string {
  return value === null ? "–" : `${value.toLocaleString("de-DE", { maximumFractionDigits: digits })}${suffix}`;
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
        setPlayers(loaded); setPlayerId((current) => current ?? loaded[0]?.id ?? null); setMessage(loaded.length ? "" : "Noch keine aktiven Spieler vorhanden.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Statistiken konnten nicht geladen werden."); }
    }
    void load();
  }, []);

  const selected = useMemo(() => players.find((player) => player.id === playerId) ?? null, [players, playerId]);

  return (
    <main className={`${styles.root} dashboard-page analysis-page`}>
      <section className="dashboard-heading analysis-heading">
        <div><div className="eyebrow">Persönliche Entwicklung</div><h1>Spielerstatistik</h1><p>Scoring, Checkout, Trefferübungen und letzte Trainingswerte auf einen Blick.</p></div>
        <label className="analysis-player-select"><span>Spieler auswählen</span><select value={playerId ?? ""} onChange={(event) => setPlayerId(Number(event.target.value))}>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>
      </section>

      {message && <section className="analysis-empty"><strong>{message}</strong></section>}

      {selected && <>
        <section className="analysis-profile-strip">
          <div className="analysis-avatar">{selected.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase()}</div>
          <div><small>Ausgewählter Spieler</small><h2>{selected.displayName}</h2><p>{selected.trainingDays} Trainingstage · {selected.completedExercises} gespeicherte Ergebnisse</p></div>
          <div className="analysis-profile-last"><small>Letzter Wert</small><strong>{format(selected.lastValue)}</strong></div>
        </section>

        <section className="analysis-kpis analysis-kpis-four">
          <article><small>Trainingstage</small><strong>{selected.trainingDays}</strong><span>mit Ergebnissen</span></article>
          <article><small>Übungen</small><strong>{selected.completedExercises}</strong><span>gespeicherte Werte</span></article>
          <article><small>Gesamtschnitt</small><strong>{format(selected.overallAverage)}</strong><span>alle Bewertungen</span></article>
          <article><small>Persönlicher Bestwert</small><strong>{format(selected.personalBest)}</strong><span>höchster Wert</span></article>
        </section>

        <section className="analysis-performance-grid">
          <article className="analysis-performance-card is-scoring">
            <header><div><small>Scoring</small><h2>{format(selected.scoring.average)}</h2></div><span>{selected.scoring.visits} Aufnahmen</span></header>
            <p>Durchschnitt aus allen gespeicherten Scoring-Aufnahmen.</p>
            <div className="analysis-mini-metrics"><span><small>Highscore</small><strong>{format(selected.scoring.highScore)}</strong></span><span><small>100+</small><strong>{selected.scoring.scores100}</strong></span><span><small>140+</small><strong>{selected.scoring.scores140}</strong></span><span><small>180</small><strong>{selected.scoring.scores180}</strong></span></div>
          </article>

          <article className="analysis-performance-card is-checkout">
            <header><div><small>Checkout</small><h2>{format(selected.checkout.rate, " %", 1)}</h2></div><span>{selected.checkout.successes} / {selected.checkout.attempts}</span></header>
            <p>Erfolgreiche Checks im Verhältnis zu allen gespeicherten Versuchen.</p>
            <div className="analysis-progress"><span style={{ width: `${Math.min(100, selected.checkout.rate ?? 0)}%` }} /></div>
            <div className="analysis-mini-metrics two"><span><small>Versuche</small><strong>{selected.checkout.attempts}</strong></span><span><small>Erfolge</small><strong>{selected.checkout.successes}</strong></span></div>
          </article>

          <article className="analysis-performance-card is-hits">
            <header><div><small>Trefferübungen</small><h2>{format(selected.hits.average)}</h2></div><span>pro Aufnahme</span></header>
            <p>Durchschnittliche Trefferleistung in Doppel-, Bull- und Zielübungen.</p>
            <div className="analysis-mini-metrics two"><span><small>Runden</small><strong>{selected.hits.rounds}</strong></span><span><small>Gesamttreffer</small><strong>{selected.hits.total}</strong></span></div>
          </article>
        </section>

        <section className="analysis-section">
          <div className="section-heading"><div><span className="eyebrow">Verlauf</span><h2>Letzte Ergebnisse</h2></div><span className="analysis-count">{selected.history.length} Werte</span></div>
          {selected.history.length === 0 ? <div className="analysis-empty"><strong>Noch keine Ergebnisse vorhanden</strong><p>Abgeschlossene Übungen erscheinen automatisch in diesem Verlauf.</p></div> : <div className="analysis-history-list">
            {[...selected.history].reverse().map((item, index) => <article key={`${item.date}-${index}`}><span className="analysis-history-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.exercise}</strong><small>{new Date(item.date).toLocaleString("de-DE")}</small></div><span className="analysis-kind">{item.type.replaceAll("_", " ")}</span><b>{format(item.score)}</b></article>)}
          </div>}
        </section>
      </>}
    </main>
  );
}
