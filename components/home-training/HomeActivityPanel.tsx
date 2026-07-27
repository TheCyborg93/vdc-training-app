"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useHomeInsights } from "./HomeInsightsProvider";

const DAY_LABELS = ["M", "D", "M", "D", "F", "S", "S"];

export default function HomeActivityPanel() {
  const { playerId, data: insights, loading, error } = useHomeInsights();
  const data = insights?.activity ?? null;
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
