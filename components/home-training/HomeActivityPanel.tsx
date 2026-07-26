"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type ActivityDay = { date: string; active: boolean };
type ActivityWeek = { key: string; label: string; activeDays: number; days: ActivityDay[] };
type FocusCount = { name: string; count: number };
type ActivityData = {
  currentWeekDays: number;
  weeklyTarget: number;
  streak: number;
  weeks: ActivityWeek[];
  focus: string;
  focusCounts: FocusCount[];
  recommendation: string;
  completedHomeSessions: number;
};

const DAY_LABELS = ["M", "D", "M", "D", "F", "S", "S"];

export default function HomeActivityPanel() {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    fetch(`/api/home-training/activity?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Aktivität konnte nicht geladen werden.");
        setData(payload as ActivityData);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Aktivität konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [playerId]);

  const maxFocus = useMemo(() => Math.max(1, ...(data?.focusCounts.map((item) => item.count) ?? [1])), [data]);

  if (!playerId) return null;

  return (
    <section className="home-activity-shell" aria-label="Persönliche Trainingsaktivität">
      <div className="home-activity-heading">
        <div><span>Persönlicher Rhythmus</span><h2>Deine letzten vier Wochen</h2></div>
        {data && <div className="home-activity-streak"><strong>{data.streak}</strong><span>aktive Wochen in Folge</span></div>}
      </div>

      {loading ? (
        <div className="home-activity-state">Aktivität wird geladen …</div>
      ) : error ? (
        <div className="home-activity-state is-error">{error}</div>
      ) : data ? (
        <div className="home-activity-grid">
          <article className="home-activity-target">
            <div className="home-activity-ring" style={{ "--home-progress": `${Math.min(100, (data.currentWeekDays / Math.max(data.weeklyTarget, 1)) * 100)}%` } as CSSProperties}>
              <strong>{data.currentWeekDays}/{data.weeklyTarget}</strong>
              <span>Einheiten</span>
            </div>
            <div><small>Wochenziel</small><h3>{data.currentWeekDays >= data.weeklyTarget ? "Ziel erreicht" : "Bleib im Rhythmus"}</h3><p>{data.recommendation}</p></div>
          </article>

          <div className="home-activity-weeks">
            {data.weeks.map((week, index) => (
              <article className={index === data.weeks.length - 1 ? "is-current" : ""} key={week.key}>
                <div><span>{week.label}</span><strong>{week.activeDays} Tage</strong></div>
                <div className="home-activity-days">
                  {week.days.map((day, dayIndex) => <span key={day.date} className={day.active ? "is-active" : ""} title={`${day.date}${day.active ? " · Training" : ""}`}>{DAY_LABELS[dayIndex]}</span>)}
                </div>
              </article>
            ))}
          </div>

          <article className="home-activity-focus">
            <div><small>Nächster Schwerpunkt</small><h3>{data.focus}</h3><p>{data.completedHomeSessions} abgeschlossene Heimtrainings in den letzten acht Wochen.</p></div>
            <div className="home-activity-bars">
              {data.focusCounts.map((item) => (
                <div key={item.name}><span>{item.name}</span><i><b style={{ width: `${Math.round((item.count / maxFocus) * 100)}%` }} /></i><strong>{item.count}</strong></div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
