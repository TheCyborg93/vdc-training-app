"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TrendValues = {
  average: number | null;
  first9: number | null;
  checkoutRate: number | null;
  hitRate: number | null;
  mpr: number | null;
};

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
  comparison: TrendValues & { hasPrevious: boolean; previousResults: number };
};

type Comparison = {
  periodDays: number;
  windows: { current: { start: string; end: string }; previous: { start: string; end: string } };
  overview: {
    players: number;
    analyzedPlayers: number;
    playersWithComparison: number;
    results: number;
    average: number;
    first9: number;
    checkoutRate: number;
    hitRate: number;
    trend: { average: number; first9: number; checkoutRate: number; hitRate: number };
  };
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

function dateLabel(value?: string) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function trendLabel(value: number | null | undefined, percent = false) {
  if (value === null || value === undefined) return { text: "–", tone: "neutral" };
  const rounded = Math.round(value * 100) / 100;
  return {
    text: `${rounded > 0 ? "+" : ""}${rounded}${percent ? " %-Pkt." : ""}`,
    tone: rounded > 0 ? "positive" : rounded < 0 ? "negative" : "neutral",
  };
}

function Trend({ value, percent = false }: { value: number | null | undefined; percent?: boolean }) {
  const trend = trendLabel(value, percent);
  return <span className={`analysis-trend is-${trend.tone}`}>{trend.text}</span>;
}

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

  return <main className="dashboard-page analysis-page player-profile-v3">
    <section className="dashboard-heading analysis-heading">
      <div>
        <div className="eyebrow">Phase 7.1 · Vereinsanalyse</div>
        <h1>Spielervergleich</h1>
        <p>Aktueller Zeitraum {dateLabel(data?.windows.current.start)}–{dateLabel(data?.windows.current.end)} im Vergleich zu {dateLabel(data?.windows.previous.start)}–{dateLabel(data?.windows.previous.end)}.</p>
      </div>
      <div className="analysis-toolbar">
        <label>Zeitraum<select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} aria-label="Analysezeitraum"><option value={30}>30 Tage</option><option value={90}>90 Tage</option><option value={180}>180 Tage</option><option value={365}>365 Tage</option></select></label>
        <label>Sortierung<select value={sortMetric} onChange={(event) => setSortMetric(event.target.value as SortMetric)} aria-label="Sortierung">{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Link className="button secondary" href="/trainer/spieler">Spieler verwalten</Link>
      </div>
    </section>

    {error ? <section className="analysis-message is-error"><strong>Vergleich nicht verfügbar</strong><p>{error}</p></section> : null}

    <section className="analysis-kpis">
      <article><small>Aktive Spieler</small><strong>{data?.overview.players ?? 0}</strong><span>{data?.overview.analyzedPlayers ?? 0} mit Daten</span></article>
      <article><small>Vereins-Average</small><strong>{data?.overview.average ?? 0}</strong><Trend value={data?.overview.trend.average} /></article>
      <article><small>Vereins-First 9</small><strong>{data?.overview.first9 ?? 0}</strong><Trend value={data?.overview.trend.first9} /></article>
      <article><small>Checkoutquote</small><strong>{data?.overview.checkoutRate ?? 0} %</strong><Trend value={data?.overview.trend.checkoutRate} percent /></article>
      <article><small>Trefferquote</small><strong>{data?.overview.hitRate ?? 0} %</strong><Trend value={data?.overview.trend.hitRate} percent /></article>
      <article><small>Vergleichsbasis</small><strong>{data?.overview.playersWithComparison ?? 0}</strong><span>Spieler mit Daten in beiden Zeiträumen</span></article>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Rangliste</span><h2>Sortiert nach {metricLabels[sortMetric]}</h2></div></div>
      {loading ? <p>Vereinsanalyse wird berechnet …</p> : players.length ? <div className="coach-area-list">
        {players.map((player, index) => <div className="coach-area-row" key={player.playerId}>
          <div><strong>#{index + 1} · {player.playerName}</strong><small>{player.results} Aufnahmen · {player.activeDays} Trainingstage · Datenlage {player.dataQuality === "STRONG" ? "stark" : player.dataQuality === "MEDIUM" ? "mittel" : "gering"}</small></div>
          <div className="coach-area-track"><i style={{ width: `${Math.max(2, player[sortMetric] / maxValue * 100)}%` }} /></div>
          <div className="analysis-rank-value"><b>{player[sortMetric]}{sortMetric === "checkoutRate" || sortMetric === "hitRate" ? " %" : ""}</b><Trend value={player.comparison[sortMetric]} percent={sortMetric === "checkoutRate" || sortMetric === "hitRate"} /></div>
          <Link href={`/trainer/spieler/${player.playerId}`}>Profil</Link>
        </div>)}
      </div> : <div className="analysis-empty"><strong>Noch keine Vergleichsdaten</strong><p>Sobald genügend Trainingsdaten vorhanden sind, erscheint hier die Rangliste.</p></div>}
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Detailvergleich</span><h2>Aktueller Wert und Entwicklung</h2></div></div>
      <div className="analysis-scroll"><table className="analysis-table is-wide"><thead><tr><th>Spieler</th><th>AVG</th><th>First 9</th><th>Checkout</th><th>Treffer</th><th>MPR</th><th>Highscore</th><th>Nullaufnahmen</th></tr></thead><tbody>{players.map((player) => <tr key={player.playerId}>
        <td><Link href={`/trainer/spieler/${player.playerId}`}>{player.playerName}</Link><small>{player.comparison.previousResults} frühere Aufnahmen</small></td>
        <td><strong>{player.average}</strong><Trend value={player.comparison.average} /></td>
        <td><strong>{player.first9}</strong><Trend value={player.comparison.first9} /></td>
        <td><strong>{player.checkoutRate} %</strong><Trend value={player.comparison.checkoutRate} percent /></td>
        <td><strong>{player.hitRate} %</strong><Trend value={player.comparison.hitRate} percent /></td>
        <td><strong>{player.mpr}</strong><Trend value={player.comparison.mpr} /></td>
        <td>{player.highScore}</td><td>{player.zeroVisits}</td>
      </tr>)}</tbody></table></div>
    </section>
  </main>;
}
