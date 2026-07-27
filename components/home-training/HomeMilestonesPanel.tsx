"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Milestone = {
  key: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  unlocked: boolean;
};

type MilestoneData = {
  summary: {
    unlocked: number;
    total: number;
    activityDays: number;
    completedSessions: number;
    totalResults: number;
    totalMinutes: number;
    bestScore: number;
  };
  next: Milestone | null;
  milestones: Milestone[];
};

function progress(item: Milestone) {
  return Math.min(100, Math.round((item.current / Math.max(item.target, 1)) * 100));
}

export default function HomeMilestonesPanel() {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [data, setData] = useState<MilestoneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

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
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/home-training/milestones?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Meilensteine konnten nicht geladen werden.");
        setData(payload as MilestoneData);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Meilensteine konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [playerId]);

  if (!playerId) return null;

  const visible = data?.milestones.filter((item) => showAll || item.unlocked || item.key === data.next?.key) ?? [];
  const totalProgress = data ? Math.round((data.summary.unlocked / Math.max(data.summary.total, 1)) * 100) : 0;

  return (
    <section className="home-milestones" aria-label="Persönliche Meilensteine">
      <div className="home-milestones-head">
        <div><span>Persönliche Erfolge</span><h2>Deine Meilensteine</h2><p>Jede gespeicherte Aufnahme und jede abgeschlossene Einheit zählt.</p></div>
        {data && (
          <div className="home-milestones-score" style={{ "--milestone-progress": `${totalProgress}%` } as CSSProperties}>
            <strong>{data.summary.unlocked}/{data.summary.total}</strong><span>freigeschaltet</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="home-milestones-state">Meilensteine werden geladen …</div>
      ) : error ? (
        <div className="home-milestones-state is-error">{error}</div>
      ) : data ? (
        <>
          {data.next && (
            <article className="home-milestones-next">
              <div><span>Nächstes Ziel</span><h3>{data.next.title}</h3><p>{data.next.description}</p></div>
              <div className="home-milestones-next-progress">
                <strong>{Math.min(data.next.current, data.next.target)} / {data.next.target}</strong>
                <span>{data.next.unit}</span>
                <i><b style={{ width: `${progress(data.next)}%` }} /></i>
              </div>
            </article>
          )}

          <div className="home-milestones-grid">
            {visible.map((item) => (
              <article className={item.unlocked ? "is-unlocked" : "is-locked"} key={item.key}>
                <div className="home-milestones-icon" aria-hidden="true">{item.unlocked ? "✓" : "◇"}</div>
                <div><span>{item.unlocked ? "Freigeschaltet" : `${progress(item)} %`}</span><h3>{item.title}</h3><p>{item.description}</p></div>
                <div className="home-milestones-progress"><i><b style={{ width: `${progress(item)}%` }} /></i><small>{Math.min(item.current, item.target)} / {item.target} {item.unit}</small></div>
              </article>
            ))}
          </div>

          <button className="home-milestones-toggle" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Nur Erfolge und nächstes Ziel" : `Alle ${data.summary.total} Meilensteine anzeigen`}
          </button>
        </>
      ) : null}
    </section>
  );
}
