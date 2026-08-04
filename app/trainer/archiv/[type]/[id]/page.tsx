"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Metrics = { resultCount: number; scoredResults: number; average: number | null; highScore: number | null; zeroVisits: number };
type Detail = {
  type: "CLUB" | "HOME";
  id: number;
  title: string;
  goal: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMin: number;
  players: { id: number; name: string }[];
  boards: { id: number; name: string; status: string }[];
  metrics: Metrics;
  exercises: Array<{ id: number; name: string; engine: string; position: number; durationMin: number | null; resultCount: number; average: number | null; highScore: number | null; zeroVisits: number }>;
  sessions: Array<{ id: number; board: string; status: string; startedAt: string | null; completedAt: string | null; metrics: Metrics }>;
  results: Array<{ id: number; playerId: number; playerName: string; exerciseId: number; exerciseName: string; engine: string; boardSessionId: number; board: string; roundNumber: number; score: number | null; value: Record<string, unknown>; createdAt: string }>;
};

function number(value: number | null, digits = 1) {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function valuePreview(value: Record<string, unknown>) {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null).slice(0, 5);
  if (!entries.length) return "Keine Zusatzdaten";
  return entries.map(([key, item]) => `${key}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`).join(" · ");
}

export default function TrainingHistoryDetailPage() {
  const params = useParams<{ type: string; id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [exerciseId, setExerciseId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/trainer/history/${params.type}/${params.id}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Trainingseinheit konnte nicht geladen werden.");
        setDetail(payload);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Trainingseinheit konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }
    void load();
  }, [params.id, params.type]);

  const results = useMemo(() => (detail?.results ?? []).filter((result) => {
    if (playerId && result.playerId !== Number(playerId)) return false;
    if (exerciseId && result.exerciseId !== Number(exerciseId)) return false;
    return true;
  }), [detail?.results, exerciseId, playerId]);

  if (loading) return <main className="dashboard-page"><section className="card"><p>Trainingseinheit wird geladen …</p></section></main>;
  if (error || !detail) return <main className="dashboard-page"><section className="card"><h1>Training nicht verfügbar</h1><p>{error || "Einheit nicht gefunden."}</p><Link className="button secondary" href="/trainer/archiv">Zur Historie</Link></section></main>;

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div><div className="eyebrow">Phase 7.2 · {detail.type === "CLUB" ? "Vereinstraining" : "Heimtraining"}</div><h1>{detail.title}</h1><p>{detail.goal} · {new Date(detail.startedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</p></div>
      <div className="analysis-heading-actions"><Link className="button secondary" href="/trainer/archiv">Zur Historie</Link>{detail.players[0] ? <Link className="button" href={`/trainer/spieler/${detail.players[0].id}`}>Spieleranalyse</Link> : null}</div>
    </section>

    <section className="analysis-kpis">
      <article><small>Dauer</small><strong>{detail.durationMin}</strong><span>Minuten</span></article>
      <article><small>Spieler</small><strong>{detail.players.length}</strong><span>Teilnehmer</span></article>
      <article><small>Übungen</small><strong>{detail.exercises.length}</strong><span>Trainingsblöcke</span></article>
      <article><small>Aufnahmen</small><strong>{detail.metrics.resultCount}</strong><span>{detail.metrics.zeroVisits} Nullaufnahmen</span></article>
      <article><small>Ø Ergebnis</small><strong>{number(detail.metrics.average)}</strong><span>Bestwert {number(detail.metrics.highScore, 0)}</span></article>
    </section>

    <section className="coach-analysis-grid">
      <article className="card"><span className="eyebrow">Teilnehmer</span><h2>Spieler</h2><div className="analysis-chip-list">{detail.players.map((player) => <Link key={player.id} href={`/trainer/spieler/${player.id}`}>{player.name}</Link>)}</div></article>
      <article className="card"><span className="eyebrow">Boards & Sessions</span><h2>{detail.type === "CLUB" ? "Boardübersicht" : "Heimboard"}</h2>{detail.sessions.map((session) => <div className="player-insight-row" key={session.id}><div><strong>{session.board}</strong><small>{session.metrics.resultCount} Aufnahmen · {session.status}</small></div><span>{number(session.metrics.average)}</span></div>)}</article>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Trainingsablauf</span><h2>Übungen und Ergebnisse</h2></div></div>
      <div className="analysis-exercise-list">{detail.exercises.map((exercise) => <div key={exercise.id}><span>{String(exercise.position).padStart(2, "0")}</span><strong>{exercise.name}</strong><small>{exercise.engine} · {exercise.resultCount} Aufnahmen · Ø {number(exercise.average)} · Best {number(exercise.highScore, 0)}{exercise.durationMin ? ` · ${exercise.durationMin} Min.` : ""}</small></div>)}</div>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Aufnahmen</span><h2>Chronologisches Ergebnisprotokoll</h2></div><span className="analysis-count">{results.length} Einträge</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}>
        <label>Spieler<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Alle Spieler</option>{detail.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
        <label>Übung<select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}><option value="">Alle Übungen</option>{detail.exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
      </div>
      {results.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}><thead><tr><th>Zeit</th><th>Spieler</th><th>Board</th><th>Übung</th><th>Runde</th><th>Score</th><th>Details</th></tr></thead><tbody>{results.map((result) => <tr key={`${result.boardSessionId}:${result.id}`}><td>{new Date(result.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td><Link href={`/trainer/spieler/${result.playerId}`}>{result.playerName}</Link></td><td>{result.board}</td><td>{result.exerciseName}</td><td>{result.roundNumber}</td><td><strong>{result.score ?? "–"}</strong></td><td><small>{valuePreview(result.value)}</small></td></tr>)}</tbody></table></div> : <p>Für die gewählten Filter sind keine Aufnahmen vorhanden.</p>}
    </section>
  </main>;
}
