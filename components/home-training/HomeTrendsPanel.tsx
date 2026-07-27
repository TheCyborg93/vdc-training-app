"use client";

import { useMemo } from "react";
import { useHomeInsights } from "./HomeInsightsProvider";

function formatValue(value: number | null, suffix = "") {
  if (value === null) return "–";
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}${suffix}`;
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="trend-delta is-neutral">kein Vergleich</span>;
  const tone = value > 0 ? "is-up" : value < 0 ? "is-down" : "is-neutral";
  const prefix = value > 0 ? "+" : "";
  return <span className={`trend-delta ${tone}`}>{prefix}{value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}{suffix}</span>;
}

export default function HomeTrendsPanel() {
  const { playerId, data: insights, loading, error } = useHomeInsights();
  const data = insights?.trends ?? null;
  const maxResults = useMemo(() => Math.max(1, ...(data?.weeks.map((week) => week.results) ?? [1])), [data]);

  if (!playerId) return null;

  return (
    <section className="home-trends-shell" aria-label="Persönliche Leistungsentwicklung">
      <div className="home-trends-heading">
        <div><span>Leistungsentwicklung</span><h2>Letzte vier Wochen im Vergleich</h2></div>
        {data && <small>{data.period.current}</small>}
      </div>

      {loading ? (
        <div className="home-trends-state">Trends werden berechnet …</div>
      ) : error ? (
        <div className="home-trends-state is-error">{error}</div>
      ) : data ? (
        <>
          <div className="home-trends-kpis">
            <article><small>Aktive Tage</small><strong>{data.current.activeDays}</strong><Delta value={data.deltas.activeDays} /></article>
            <article><small>Ergebnisse</small><strong>{data.current.results}</strong><Delta value={data.deltas.results} /></article>
            <article><small>Durchschnitt</small><strong>{formatValue(data.current.average)}</strong><Delta value={data.deltas.average} /></article>
            <article><small>Bestwert</small><strong>{formatValue(data.current.best)}</strong><Delta value={data.deltas.best} /></article>
            <article><small>Checkoutquote</small><strong>{formatValue(data.current.checkoutRate, " %")}</strong><Delta value={data.deltas.checkoutRate} suffix=" %" /></article>
          </div>

          <div className="home-trends-grid">
            <article className="home-trends-chart">
              <div><small>Acht-Wochen-Verlauf</small><h3>Trainingsvolumen</h3></div>
              <div className="home-trends-bars">
                {data.weeks.map((week) => (
                  <div key={week.key} title={`${week.results} Ergebnisse · ${week.activeDays} aktive Tage`}>
                    <span><i style={{ height: `${Math.max(6, Math.round((week.results / maxResults) * 100))}%` }} /></span>
                    <strong>{week.results}</strong>
                    <small>{week.label}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="home-trends-improvement">
              <small>Stärkste Entwicklung</small>
              {data.bestImprovement ? (
                <>
                  <h3>{data.bestImprovement.exercise}</h3>
                  <strong>+{data.bestImprovement.delta.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</strong>
                  <p>Von {data.bestImprovement.previousAverage.toLocaleString("de-DE", { maximumFractionDigits: 1 })} auf {data.bestImprovement.currentAverage.toLocaleString("de-DE", { maximumFractionDigits: 1 })} im Durchschnitt.</p>
                </>
              ) : (
                <>
                  <h3>Noch kein stabiler Vergleich</h3>
                  <p>Für eine belastbare Übungsentwicklung werden Ergebnisse in beiden Vier-Wochen-Zeiträumen benötigt.</p>
                </>
              )}
              <span>Vergleichszeitraum: {data.period.previous}</span>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
