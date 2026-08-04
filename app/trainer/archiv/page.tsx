"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Player = { id: number; displayName: string };
type HistoryItem = {
  id: string;
  sourceId: number;
  type: "CLUB" | "HOME";
  title: string;
  goal: string;
  startedAt: string;
  completedAt: string | null;
  durationMin: number;
  players: { id: number; name: string }[];
  boards: string[];
  exercises: string[];
  resultCount: number;
  average: number | null;
  highScore: number | null;
  detailHref: string;
};
type HistoryResponse = {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  summary: { sessions: number; clubSessions: number; homeSessions: number; totalMinutes: number; resultCount: number; players: number; average: number | null };
  items: HistoryItem[];
};

function formatNumber(value: number | null, digits = 1) {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export default function TrainingArchivePage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [periodDays, setPeriodDays] = useState(365);

  const params = useMemo(() => {
    const value = new URLSearchParams({ periodDays: String(periodDays), limit: "30", offset: "0" });
    if (query.trim()) value.set("query", query.trim());
    if (type) value.set("type", type);
    if (playerId) value.set("playerId", playerId);
    return value;
  }, [periodDays, playerId, query, type]);

  useEffect(() => {
    fetch("/api/players", { cache: "no-store" }).then((response) => response.json()).then((payload) => setPlayers(Array.isArray(payload) ? payload : [])).catch(() => setPlayers([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/trainer/history?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Historie konnte nicht geladen werden.");
        setData(payload);
        setError("");
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError(loadError instanceof Error ? loadError.message : "Historie konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [params]);

  async function loadMore() {
    if (!data?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = new URLSearchParams(params);
      next.set("offset", String(data.items.length));
      const response = await fetch(`/api/trainer/history?${next}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Weitere Einträge konnten nicht geladen werden.");
      setData({ ...payload, items: [...data.items, ...payload.items] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Weitere Einträge konnten nicht geladen werden.");
    } finally { setLoadingMore(false); }
  }

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div><div className="eyebrow">Phase 7.2 · Trainingshistorie</div><h1>Trainingshistorie</h1><p>Vereins- und Heimtraining gemeinsam durchsuchen, vergleichen und bis zur einzelnen Einheit nachvollziehen.</p></div>
      <div className="analysis-heading-actions"><Link className="button secondary" href="/trainer/spieler/vergleich">Vereinsvergleich</Link><Link className="button" href="/trainer/trainingsplaene">Trainingspläne</Link></div>
    </section>

    <section className="analysis-kpis">
      <article><small>Einheiten</small><strong>{data?.summary.sessions ?? 0}</strong><span>{data?.summary.clubSessions ?? 0} Verein · {data?.summary.homeSessions ?? 0} Zuhause</span></article>
      <article><small>Trainingszeit</small><strong>{data?.summary.totalMinutes ?? 0}</strong><span>Minuten im Zeitraum</span></article>
      <article><small>Aufnahmen</small><strong>{data?.summary.resultCount ?? 0}</strong><span>gültig gespeichert</span></article>
      <article><small>Spieler</small><strong>{data?.summary.players ?? 0}</strong><span>verschiedene Teilnehmer</span></article>
      <article><small>Ø Ergebnis</small><strong>{formatNumber(data?.summary.average ?? null)}</strong><span>über alle Einheiten</span></article>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Filter</span><h2>Schnell zur gesuchten Einheit</h2></div><span className="analysis-count">{data?.total ?? 0} Treffer</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(3,minmax(150px,1fr))", gap: 12 }}>
        <label>Suche<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Training, Ziel, Übung oder Spieler" /></label>
        <label>Trainingstyp<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Alle</option><option value="CLUB">Verein</option><option value="HOME">Zuhause</option></select></label>
        <label>Spieler<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Alle Spieler</option>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>
        <label>Zeitraum<select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}><option value={30}>30 Tage</option><option value={90}>90 Tage</option><option value={180}>180 Tage</option><option value={365}>1 Jahr</option><option value={1095}>3 Jahre</option><option value={3650}>Gesamt</option></select></label>
      </div>
    </section>

    <section className="analysis-section">
      <div className="section-heading"><div><span className="eyebrow">Chronik</span><h2>Trainingseinheiten</h2></div></div>
      {error ? <div className="analysis-empty"><strong>Historie nicht verfügbar</strong><p>{error}</p></div> : null}
      {loading && !data ? <div className="card"><p>Trainingshistorie wird geladen …</p></div> : null}
      {!loading && data?.items.length === 0 ? <div className="analysis-empty"><strong>Keine passenden Einheiten</strong><p>Ändere den Zeitraum oder entferne einzelne Filter.</p></div> : null}
      <div className="analysis-archive-list">
        {(data?.items ?? []).map((item) => <article className="analysis-training-card" key={item.id}>
          <header>
            <div><small>{new Date(item.startedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</small><h2>{item.title}</h2><p>{item.goal}</p></div>
            <span className="analysis-status"><i /> {item.type === "CLUB" ? "Vereinstraining" : "Heimtraining"}</span>
          </header>
          <div className="analysis-training-facts">
            <span><small>Dauer</small><strong>{item.durationMin} Min.</strong></span>
            <span><small>Spieler</small><strong>{item.players.length}</strong></span>
            <span><small>Boards</small><strong>{item.boards.length || "–"}</strong></span>
            <span><small>Übungen</small><strong>{item.exercises.length}</strong></span>
            <span><small>Aufnahmen</small><strong>{item.resultCount}</strong></span>
            <span><small>Ø Ergebnis</small><strong>{formatNumber(item.average)}</strong></span>
            <span><small>Bestwert</small><strong>{item.highScore ?? "–"}</strong></span>
          </div>
          <div className="analysis-training-details">
            <section><small>Teilnehmer</small><div className="analysis-chip-list">{item.players.map((player) => <Link key={player.id} href={`/trainer/spieler/${player.id}`}>{player.name}</Link>)}</div></section>
            <section><small>Übungen</small><div className="analysis-chip-list">{item.exercises.slice(0, 8).map((exercise) => <span key={exercise}>{exercise}</span>)}</div></section>
          </div>
          <div className="actions"><Link className="button secondary" href={item.detailHref}>Einheit öffnen</Link></div>
        </article>)}
      </div>
      {data?.hasMore ? <div className="actions" style={{ justifyContent: "center", marginTop: 18 }}><button className="button secondary" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Lädt …" : "Weitere Einheiten laden"}</button></div> : null}
    </section>
  </main>;
}
