"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type HistoryItem = {
  id: string;
  type: "CLUB" | "HOME";
  title: string;
  goal: string;
  startedAt: string;
  durationMin: number;
  exercises: string[];
  resultCount: number;
  average: number | null;
  highScore: number | null;
  detailHref: string;
};

type HistoryResponse = {
  total: number;
  hasMore: boolean;
  summary: {
    sessions: number;
    clubSessions: number;
    homeSessions: number;
    totalMinutes: number;
    resultCount: number;
    average: number | null;
  };
  items: HistoryItem[];
};

type Player = { id: number; displayName: string; firstName: string };

function formatNumber(value: number | null, digits = 1) {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export default function PlayerTrainingHistoryPage() {
  const params = useParams<{ id: string }>();
  const playerId = Number(params.id);
  const [player, setPlayer] = useState<Player | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [periodDays, setPeriodDays] = useState(365);
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const value = new URLSearchParams({ playerId: String(playerId), periodDays: String(periodDays), limit: "100" });
    if (type) value.set("type", type);
    if (query.trim()) value.set("query", query.trim());
    return value;
  }, [periodDays, playerId, query, type]);

  useEffect(() => {
    async function loadPlayer() {
      try {
        const response = await fetch("/api/players", { cache: "no-store" });
        const payload = await response.json();
        setPlayer((Array.isArray(payload) ? payload : []).find((item: Player) => item.id === playerId) ?? null);
      } catch { setPlayer(null); }
    }
    if (Number.isInteger(playerId)) void loadPlayer();
  }, [playerId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/trainer/history?${search}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Trainingschronik konnte nicht geladen werden.");
        setData(payload);
        setError("");
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError(loadError instanceof Error ? loadError.message : "Trainingschronik konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search]);

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div><div className="eyebrow">Phase 7.2 · Persönliche Chronik</div><h1>{player?.displayName ?? "Spielerchronik"}</h1><p>{player?.firstName ?? ""} · Alle Vereins- und Heimtrainings in zeitlicher Reihenfolge.</p></div>
      <div className="analysis-heading-actions"><Link className="button secondary" href={`/trainer/spieler/${playerId}`}>Zur Analyse</Link><Link className="button" href="/trainer/archiv">Gesamte Historie</Link></div>
    </section>

    <section className="analysis-kpis">
      <article><small>Einheiten</small><strong>{data?.summary.sessions ?? 0}</strong><span>{data?.summary.clubSessions ?? 0} Verein · {data?.summary.homeSessions ?? 0} Zuhause</span></article>
      <article><small>Trainingszeit</small><strong>{data?.summary.totalMinutes ?? 0}</strong><span>Minuten</span></article>
      <article><small>Aufnahmen</small><strong>{data?.summary.resultCount ?? 0}</strong><span>gespeichert</span></article>
      <article><small>Ø Ergebnis</small><strong>{formatNumber(data?.summary.average ?? null)}</strong><span>im Zeitraum</span></article>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Filter</span><h2>Persönliche Einheiten durchsuchen</h2></div><span className="analysis-count">{data?.total ?? 0} Treffer</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(2,minmax(160px,1fr))", gap: 12 }}>
        <label>Suche<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Training, Ziel oder Übung" /></label>
        <label>Trainingstyp<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Alle</option><option value="CLUB">Verein</option><option value="HOME">Zuhause</option></select></label>
        <label>Zeitraum<select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}><option value={30}>30 Tage</option><option value={90}>90 Tage</option><option value={180}>180 Tage</option><option value={365}>1 Jahr</option><option value={1095}>3 Jahre</option><option value={3650}>Gesamt</option></select></label>
      </div>
    </section>

    <section className="analysis-section">
      {error ? <div className="analysis-empty"><strong>Chronik nicht verfügbar</strong><p>{error}</p></div> : null}
      {loading && !data ? <div className="card"><p>Persönliche Trainingschronik wird geladen …</p></div> : null}
      {!loading && data?.items.length === 0 ? <div className="analysis-empty"><strong>Noch keine passenden Einheiten</strong><p>Für die gewählten Filter sind keine Trainings vorhanden.</p></div> : null}
      <div className="analysis-archive-list">{(data?.items ?? []).map((item) => <article className="analysis-training-card" key={item.id}>
        <header><div><small>{new Date(item.startedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</small><h2>{item.title}</h2><p>{item.goal}</p></div><span className="analysis-status"><i /> {item.type === "CLUB" ? "Verein" : "Zuhause"}</span></header>
        <div className="analysis-training-facts"><span><small>Dauer</small><strong>{item.durationMin} Min.</strong></span><span><small>Übungen</small><strong>{item.exercises.length}</strong></span><span><small>Aufnahmen</small><strong>{item.resultCount}</strong></span><span><small>Ø Ergebnis</small><strong>{formatNumber(item.average)}</strong></span><span><small>Bestwert</small><strong>{formatNumber(item.highScore, 0)}</strong></span></div>
        <div className="analysis-chip-list">{item.exercises.slice(0, 8).map((exercise) => <span key={exercise}>{exercise}</span>)}</div>
        <div className="actions"><Link className="button secondary" href={item.detailHref}>Einheit öffnen</Link><Link className="button" href={`/trainer/archiv/vergleich?left=${encodeURIComponent(item.id)}`}>Vergleichen</Link></div>
      </article>)}</div>
    </section>
  </main>;
}
