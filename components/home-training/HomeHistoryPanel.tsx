"use client";

import { useEffect, useState } from "react";

type SessionItem = {
  id: number;
  title: string;
  goal: string;
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  completedAt: string | null;
  resultCount: number;
  exerciseCount: number;
  strongest: { exercise: string; score: number | null; resultType: string } | null;
};

type BestResult = { exercise: string; score: number; resultType: string; createdAt: string };
type HistoryData = {
  summary: { sessions: number; minutes: number; results: number; averageMinutes: number };
  sessions: SessionItem[];
  bestResults: BestResult[];
};

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function HomeHistoryPanel() {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    function connect() {
      const select = document.querySelector<HTMLSelectElement>("#home-player");
      if (!select) {
        window.setTimeout(connect, 120);
        return;
      }
      const sync = () => {
        const value = Number(select.value);
        if (!cancelled && Number.isInteger(value)) setPlayerId(value);
      };
      sync();
      select.addEventListener("change", sync);
      cleanup = () => select.removeEventListener("change", sync);
    }
    connect();
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setExpanded(null);
    fetch(`/api/home-training/history?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Historie konnte nicht geladen werden.");
        setData(payload as HistoryData);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Historie konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [playerId]);

  if (!playerId) return null;

  return (
    <section className="home-history-shell" aria-label="Persönliche Trainingshistorie">
      <header className="home-history-heading">
        <div><span>Trainingsarchiv</span><h2>Deine letzten Einheiten</h2></div>
        {data && <strong>{data.summary.sessions} Abschlüsse</strong>}
      </header>

      {loading ? (
        <div className="home-history-state">Historie wird geladen …</div>
      ) : error ? (
        <div className="home-history-state is-error">{error}</div>
      ) : data ? (
        <>
          <div className="home-history-kpis">
            <article><span>Trainingszeit</span><strong>{data.summary.minutes}</strong><small>Minuten in den letzten Einheiten</small></article>
            <article><span>Ergebnisse</span><strong>{data.summary.results}</strong><small>gespeicherte Aufnahmen</small></article>
            <article><span>Ø Dauer</span><strong>{data.summary.averageMinutes}</strong><small>Minuten pro Einheit</small></article>
          </div>

          <div className="home-history-layout">
            <div className="home-history-list">
              {data.sessions.map((session) => (
                <article className={expanded === session.id ? "is-expanded" : ""} key={session.id}>
                  <button type="button" onClick={() => setExpanded((value) => value === session.id ? null : session.id)}>
                    <div><span>{session.goal}</span><strong>{session.title}</strong><small>{formatDate(session.completedAt)}</small></div>
                    <div className="home-history-session-numbers"><b>{session.actualMinutes} Min.</b><b>{session.resultCount} Ergebnisse</b></div>
                    <i>{expanded === session.id ? "−" : "+"}</i>
                  </button>
                  {expanded === session.id && (
                    <div className="home-history-details">
                      <div><span>Übungen</span><strong>{session.exerciseCount}</strong></div>
                      <div><span>Geplant</span><strong>{session.plannedMinutes} Min.</strong></div>
                      <div><span>Tatsächlich</span><strong>{session.actualMinutes} Min.</strong></div>
                      <div><span>Stärkstes Ergebnis</span><strong>{session.strongest ? `${session.strongest.exercise} · ${session.strongest.score}` : "Noch kein Wert"}</strong></div>
                    </div>
                  )}
                </article>
              ))}
              {data.sessions.length === 0 && <div className="home-history-state">Noch kein Heimtraining abgeschlossen.</div>}
            </div>

            <aside className="home-history-best">
              <div><span>Persönliche Bestwerte</span><h3>Top-Übungen</h3></div>
              {data.bestResults.map((result, index) => (
                <article key={result.exercise}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div><strong>{result.exercise}</strong><small>{formatDate(result.createdAt)}</small></div>
                  <em>{result.score}</em>
                </article>
              ))}
              {data.bestResults.length === 0 && <p>Noch keine gewerteten Ergebnisse vorhanden.</p>}
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
