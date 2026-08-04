"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ComparisonPlayer = {
  playerId: number;
  playerName: string;
  firstName: string;
  rank: number | null;
  results: number;
  activeDays: number;
  sessions: number;
  average: number;
  first9: number;
  checkoutRate: number;
  hitRate: number;
  mpr: number;
  highScore: number;
  zeroVisits: number;
  dataQuality: "STRONG" | "MEDIUM" | "LOW";
};

type Comparison = {
  periodDays: number;
  overview: { players: number; analyzedPlayers: number; results: number; average: number; first9: number; checkoutRate: number; hitRate: number };
  players: ComparisonPlayer[];
};

const metricLabels = {
  average: "Average",
  first9: "First 9",
  checkoutRate: "Checkoutquote",
  hitRate: "Trefferquote",
  mpr: "Cricket MPR",
} as const;

type SortMetric = keyof typeof metricLabels;

export default function PlayerComparisonPage() {
  const [periodDays, setPeriodDays] = useState(90);
  const [sortMetric, setSortMetric] = useState<SortMetric>("average");
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/trainer/analytics/club?periodDays=${periodDays}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Vergleich konnte nicht geladen werden.");
        setData(payload);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Vergleich konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }
    void load();
  }, [periodDays]);

  const players = useMemo(() => [...(data?.players ?? [])].sort((a, b) => b[sortMetric] - a[sortMetric] || b.results - a.results), [data?.players, sortMetric]);
  const maxValue = Math.max(1, ...players.map((player) => player[sortMetric]));

  return <main className="dashboard-page player-profile-v3">
    <section className="dashboard-heading">
      <div><div className="eyebrow">Phase 7.1 · Vereinsanalyse</div><h1>Spielervergleich</h1><p>Alle aktiven Spieler anhand derselben Trainingsdaten und Zeiträume vergleichen.</p></div>
      <div className="actions">
        <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} aria-label="Analysezeitraum">
          <option value={30}>30 Tage</option><option value={90}>90 Tage</option><option value={180}>180 Tage</option><option value={365}>365 Tage</option>
        </select>
        <select value={sortMetric} onChange={(event) => setSortMetric(event.target.value as SortMetric)} aria-label="Sortierung">
          {Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Link className="button secondary" href="/trainer/spieler">Spieler verwalten</Link>
      </div>
    </section>

    {error ? <section className="card"><h2>Vergleich nicht verfügbar</h2><p>{error}</p></section> : null}

    <section className="coach-overview-grid">
      <article className="card"><small>Aktive Spieler</small><strong>{data?.overview.players ?? 0}</strong><span>{data?.overview.analyzedPlayers ?? 0} mit Daten</span></article>
      <article className="card"><small>Vereins-Average</small><strong>{data?.overview.average ?? 0}</strong><span>{data?.overview.results ?? 0} Aufnahmen</span></article>
      <article className="card"><small>Vereins-First 9</small><strong>{data?.overview.first9 ?? 0}</strong><span>gewählter Zeitraum</span></article>
      <article className="card"><small>Checkoutquote</small><strong>{data?.overview.checkoutRate ?? 0} %</strong><span>Vereinsmittel</span></article>
      <article className="card"><small>Trefferquote</small><strong>{data?.overview.hitRate ?? 0} %</strong><span>Vereinsmittel</span></article>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Rangliste</span><h2>Sortiert nach {metricLabels[sortMetric]}</h2></div></div>
      {loading ? <p>Vereinsanalyse wird berechnet …</p> : players.length ? <div className="coach-area-list">
        {players.map((player, index) => <div className="coach-area-row" key={player.playerId}>
          <div><strong>#{index + 1} · {player.playerName}</strong><small>{player.results} Aufnahmen · {player.activeDays} Trainingstage · Datenlage {player.dataQuality === "STRONG" ? "stark" : player.dataQuality === "MEDIUM" ? "mittel" : "gering"}</small></div>
          <div className="coach-area-track"><i style={{ width: `${Math.max(2, player[sortMetric] / maxValue * 100)}%` }} /></div>
          <b>{player[sortMetric]}{sortMetric === "checkoutRate" || sortMetric === "hitRate" ? " %" : ""}</b>
          <Link href={`/trainer/spieler/${player.playerId}`}>Profil</Link>
        </div>)}
      </div> : <p>Noch keine Spieler mit auswertbaren Trainingsdaten vorhanden.</p>}
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Detailvergleich</span><h2>Alle Kernkennzahlen</h2></div></div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead><tr><th>Spieler</th><th>AVG</th><th>First 9</th><th>Checkout</th><th>Treffer</th><th>MPR</th><th>Highscore</th><th>Nullaufnahmen</th></tr></thead>
          <tbody>{players.map((player) => <tr key={player.playerId}><td><Link href={`/trainer/spieler/${player.playerId}`}>{player.playerName}</Link></td><td>{player.average}</td><td>{player.first9}</td><td>{player.checkoutRate} %</td><td>{player.hitRate} %</td><td>{player.mpr}</td><td>{player.highScore}</td><td>{player.zeroVisits}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
