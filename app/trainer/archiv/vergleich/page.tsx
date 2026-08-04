"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type HistoryItem = { id: string; type: "CLUB" | "HOME"; title: string; startedAt: string; detailHref: string };
type Metrics = { resultCount: number; scoredResults: number; average: number | null; highScore: number | null; zeroVisits: number };
type Detail = {
  type: "CLUB" | "HOME";
  id: number;
  title: string;
  goal: string;
  startedAt: string;
  durationMin: number;
  players: { id: number; name: string }[];
  metrics: Metrics;
  exercises: Array<{ id: number; name: string; engine: string; resultCount: number; average: number | null; highScore: number | null; zeroVisits: number }>;
};

function parseKey(value: string) {
  const [type, rawId] = value.split(":");
  const id = Number(rawId);
  if ((type !== "club" && type !== "home") || !Number.isInteger(id) || id < 1) return null;
  return { type, id };
}

function number(value: number | null, digits = 1) {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value == null) return <small style={{ color: "#a7afb8" }}>–</small>;
  const positive = value > 0;
  const negative = value < 0;
  return <small style={{ color: positive ? "#22c55e" : negative ? "#ef4444" : "#a7afb8" }}>{positive ? "+" : ""}{number(value)}{suffix}</small>;
}

export default function TrainingComparisonPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [leftKey, setLeftKey] = useState(searchParams.get("left") ?? "");
  const [rightKey, setRightKey] = useState(searchParams.get("right") ?? "");
  const [left, setLeft] = useState<Detail | null>(null);
  const [right, setRight] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadItems() {
      try {
        const response = await fetch("/api/trainer/history?periodDays=3650&limit=100", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Trainingsliste konnte nicht geladen werden.");
        setItems(payload.items ?? []);
        if (!leftKey && payload.items?.[0]) setLeftKey(payload.items[0].id);
        if (!rightKey && payload.items?.[1]) setRightKey(payload.items[1].id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Trainingsliste konnte nicht geladen werden.");
      }
    }
    void loadItems();
  }, []);

  useEffect(() => {
    async function loadDetails() {
      const leftParsed = parseKey(leftKey);
      const rightParsed = parseKey(rightKey);
      if (!leftParsed || !rightParsed) return;
      setLoading(true);
      try {
        const [leftResponse, rightResponse] = await Promise.all([
          fetch(`/api/trainer/history/${leftParsed.type}/${leftParsed.id}`, { cache: "no-store" }),
          fetch(`/api/trainer/history/${rightParsed.type}/${rightParsed.id}`, { cache: "no-store" }),
        ]);
        const [leftPayload, rightPayload] = await Promise.all([leftResponse.json(), rightResponse.json()]);
        if (!leftResponse.ok) throw new Error(leftPayload.error ?? "Linke Einheit konnte nicht geladen werden.");
        if (!rightResponse.ok) throw new Error(rightPayload.error ?? "Rechte Einheit konnte nicht geladen werden.");
        setLeft(leftPayload);
        setRight(rightPayload);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Vergleich konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }
    void loadDetails();
  }, [leftKey, rightKey]);

  const metrics = useMemo(() => {
    if (!left || !right) return [];
    return [
      { label: "Dauer", left: left.durationMin, right: right.durationMin, delta: left.durationMin - right.durationMin, suffix: " Min." },
      { label: "Aufnahmen", left: left.metrics.resultCount, right: right.metrics.resultCount, delta: left.metrics.resultCount - right.metrics.resultCount, suffix: "" },
      { label: "Average", left: left.metrics.average, right: right.metrics.average, delta: left.metrics.average != null && right.metrics.average != null ? left.metrics.average - right.metrics.average : null, suffix: "" },
      { label: "Bestwert", left: left.metrics.highScore, right: right.metrics.highScore, delta: left.metrics.highScore != null && right.metrics.highScore != null ? left.metrics.highScore - right.metrics.highScore : null, suffix: "" },
      { label: "Nullaufnahmen", left: left.metrics.zeroVisits, right: right.metrics.zeroVisits, delta: left.metrics.zeroVisits - right.metrics.zeroVisits, suffix: "" },
      { label: "Übungen", left: left.exercises.length, right: right.exercises.length, delta: left.exercises.length - right.exercises.length, suffix: "" },
    ];
  }, [left, right]);

  const rightExercises = useMemo(() => new Map((right?.exercises ?? []).map((exercise) => [exercise.name, exercise] as const)), [right?.exercises]);

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div><div className="eyebrow">Phase 7.2 · Trainingsvergleich</div><h1>Zwei Einheiten vergleichen</h1><p>Leistung, Umfang und Übungsstruktur direkt gegenüberstellen.</p></div>
      <div className="analysis-heading-actions"><Link className="button secondary" href="/trainer/archiv">Zur Historie</Link></div>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Auswahl</span><h2>Vergleichseinheiten</h2></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(240px,1fr))", gap: 16 }}>
        <label>Einheit A<select value={leftKey} onChange={(event) => setLeftKey(event.target.value)}>{items.map((item) => <option key={`left-${item.id}`} value={item.id}>{new Date(item.startedAt).toLocaleDateString("de-DE")} · {item.type === "CLUB" ? "Verein" : "Zuhause"} · {item.title}</option>)}</select></label>
        <label>Einheit B<select value={rightKey} onChange={(event) => setRightKey(event.target.value)}>{items.map((item) => <option key={`right-${item.id}`} value={item.id}>{new Date(item.startedAt).toLocaleDateString("de-DE")} · {item.type === "CLUB" ? "Verein" : "Zuhause"} · {item.title}</option>)}</select></label>
      </div>
    </section>

    {error ? <section className="analysis-empty"><strong>Vergleich nicht verfügbar</strong><p>{error}</p></section> : null}
    {loading && (!left || !right) ? <section className="card"><p>Trainingseinheiten werden verglichen …</p></section> : null}

    {left && right ? <>
      <section className="coach-analysis-grid">
        {[left, right].map((detail, index) => <article className="card" key={`${detail.type}:${detail.id}`}><span className="eyebrow">Einheit {index === 0 ? "A" : "B"}</span><h2>{detail.title}</h2><p>{detail.goal}</p><small>{new Date(detail.startedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · {detail.type === "CLUB" ? "Verein" : "Zuhause"}</small><div className="analysis-chip-list" style={{ marginTop: 12 }}>{detail.players.map((player) => <Link key={player.id} href={`/trainer/spieler/${player.id}`}>{player.name}</Link>)}</div><Link className="button secondary" href={`/trainer/archiv/${detail.type.toLowerCase()}/${detail.id}`}>Details öffnen</Link></article>)}
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Kennzahlen</span><h2>Direkter Vergleich</h2></div></div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}><thead><tr><th>Kennzahl</th><th>Einheit A</th><th>Einheit B</th><th>Differenz A–B</th></tr></thead><tbody>{metrics.map((item) => <tr key={item.label}><td><strong>{item.label}</strong></td><td>{number(item.left)}{item.suffix}</td><td>{number(item.right)}{item.suffix}</td><td><Delta value={item.delta == null ? null : Math.round(item.delta * 100) / 100} suffix={item.suffix} /></td></tr>)}</tbody></table></div>
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Übungen</span><h2>Übungsstruktur im Vergleich</h2></div></div>
        <div className="analysis-exercise-list">{left.exercises.map((exercise, index) => {
          const counterpart = rightExercises.get(exercise.name);
          return <div key={`${exercise.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{exercise.name}</strong><small>A: {exercise.resultCount} Aufnahmen · Ø {number(exercise.average)} · Best {number(exercise.highScore, 0)}{counterpart ? ` | B: ${counterpart.resultCount} Aufnahmen · Ø ${number(counterpart.average)} · Best ${number(counterpart.highScore, 0)}` : " | In Einheit B nicht enthalten"}</small></div>;
        })}{right.exercises.filter((exercise) => !left.exercises.some((item) => item.name === exercise.name)).map((exercise, index) => <div key={`right-only-${exercise.name}-${index}`}><span>+</span><strong>{exercise.name}</strong><small>Nur in Einheit B · {exercise.resultCount} Aufnahmen · Ø {number(exercise.average)}</small></div>)}</div>
      </section>
    </> : null}
  </main>;
}
