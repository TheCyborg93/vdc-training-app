"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Area = { key: string; label: string; value: number; trend: number; samples: number };
type Recommendation = { area: string; title: string; reason: string; exerciseNames: string[] };
type Profile = {
  playerId: number; playerName: string; resultCount: number; activeDays: number; performanceIndex: number;
  areas: Area[]; strongest: Area[]; weakest: Area[]; recommendations: Recommendation[]; summary: string;
};
type TargetStatistic = { category: "CHECKOUT" | "DOUBLE" | "TREBLE" | "SINGLE" | "BULL"; targetKey: string; attempts: number; successes: number; rate: number };
type MetricDelta = { key: string; label: string; current: number; previous: number; unit: string; delta: number | null };
type TargetChange = TargetStatistic & { previousRate: number | null; previousAttempts: number; delta: number | null };
type FocusTarget = { category: string; targetKey: string; rate: number; attempts: number; reason: string; exerciseNames: string[] };
type Comparison = {
  hasComparison: boolean;
  currentRange: { from: string; to: string };
  previousRange: { from: string; to: string };
  previousResults: number;
  metrics: MetricDelta[];
  strongestImprovement: MetricDelta | null;
  biggestDecline: MetricDelta | null;
  improvingTargets: TargetChange[];
  decliningTargets: TargetChange[];
  focusTargets: FocusTarget[];
};
type Analytics = {
  periodDays: number;
  range: { from: string; to: string };
  overview: { results: number; activeDays: number; sessions: number; clubResults: number; homeResults: number };
  metrics: { average: number; first9: number; checkoutRate: number; checkoutAttempts: number; checkoutSuccesses: number; hitRate: number; hits: number; trackedDarts: number; mpr: number; highScore: number; zeroVisits: number };
  checkoutRanges: { range: string; attempts: number; successes: number; rate: number }[];
  targetStatistics: TargetStatistic[];
  engineDistribution: { engine: string; count: number }[];
  trend: { date: string; average: number; visits: number }[];
  comparison: Comparison;
};
type Player = { id: number; firstName: string; displayName: string; active: boolean };

function metric(value: number, suffix = "") { return `${Number.isFinite(value) ? value : 0}${suffix}`; }
function formatRange(range?: { from: string; to: string }) {
  if (!range) return "–";
  const format = (value: string) => new Intl.DateTimeFormat("de-DE").format(new Date(value));
  return `${format(range.from)}–${format(range.to)}`;
}
function heatmapBackground(rate: number, attempts: number) {
  const confidence = Math.min(1, attempts / 12);
  const alpha = 0.12 + confidence * 0.5;
  if (rate >= 70) return `rgba(34,197,94,${alpha})`;
  if (rate >= 40) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}
function Delta({ value, unit = "" }: { value: number | null | undefined; unit?: string }) {
  if (value == null) return <small style={{ color: "#a7afb8" }}>– kein Vergleich</small>;
  const positive = value > 0;
  const negative = value < 0;
  return <small style={{ color: positive ? "#22c55e" : negative ? "#ef4444" : "#a7afb8" }}>{positive ? "+" : ""}{value}{unit ? ` ${unit}` : ""}</small>;
}
function Heatmap({ title, items }: { title: string; items: TargetStatistic[] }) {
  return <article className="card"><span className="eyebrow">Heatmap</span><h2>{title}</h2>{items.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>{items.map((item) => <div key={`${item.category}:${item.targetKey}`} title={`${item.successes} Treffer bei ${item.attempts} Versuchen`} style={{ padding: 12, minHeight: 86, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: heatmapBackground(item.rate, item.attempts), display: "grid", gap: 4 }}><strong style={{ fontSize: 20 }}>{item.targetKey}</strong><span>{item.rate} %</span><small>{item.successes} / {item.attempts}</small></div>)}</div> : <p>Noch keine ausreichend genauen Zieldaten erfasst.</p>}</article>;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const playerId = Number(params.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState(90);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [coachResponse, playersResponse, analyticsResponse] = await Promise.all([
          fetch("/api/trainer/ai-coach", { cache: "no-store" }),
          fetch("/api/players", { cache: "no-store" }),
          fetch(`/api/trainer/players/${playerId}/analytics?periodDays=${periodDays}`, { cache: "no-store" }),
        ]);
        const [coachData, playersData, analyticsData] = await Promise.all([coachResponse.json(), playersResponse.json(), analyticsResponse.json()]);
        if (!coachResponse.ok) throw new Error(coachData.error ?? "Leistungsprofil konnte nicht geladen werden.");
        if (!playersResponse.ok) throw new Error(playersData.error ?? "Spieler konnte nicht geladen werden.");
        if (!analyticsResponse.ok) throw new Error(analyticsData.error ?? "Analyse konnte nicht geladen werden.");
        setProfile((coachData.profiles ?? []).find((item: Profile) => item.playerId === playerId) ?? null);
        setPlayer((playersData ?? []).find((item: Player) => item.id === playerId) ?? null);
        setAnalytics(analyticsData);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Profil konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }
    if (Number.isInteger(playerId)) void load();
  }, [playerId, periodDays]);

  const level = useMemo(() => Math.max(1, Math.floor((profile?.performanceIndex ?? 0) / 50) + 1), [profile?.performanceIndex]);
  const trendMax = Math.max(1, ...(analytics?.trend.map((point) => point.average) ?? [1]));
  const targetsByCategory = useMemo(() => {
    const map = new Map<string, TargetStatistic[]>();
    for (const item of analytics?.targetStatistics ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [analytics?.targetStatistics]);
  const deltas = useMemo(() => new Map((analytics?.comparison.metrics ?? []).map((item) => [item.key, item])), [analytics?.comparison.metrics]);

  if (loading && !analytics) return <main className="dashboard-page"><div className="card"><p>Spielerprofil wird analysiert …</p></div></main>;
  if (error || !player) return <main className="dashboard-page"><div className="card"><h1>Profil nicht verfügbar</h1><p>{error || "Der Spieler wurde nicht gefunden."}</p><Link className="button secondary" href="/trainer/spieler">Zurück zu Spielern</Link></div></main>;

  return <main className="dashboard-page player-profile-v3">
    <section className="dashboard-heading"><div><div className="eyebrow">Phase 7.1 · Spieleranalyse</div><h1>{player.displayName}</h1><p>{player.firstName} · Aktuell {formatRange(analytics?.comparison.currentRange)} · Vergleich {formatRange(analytics?.comparison.previousRange)}</p></div><div className="actions"><select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} aria-label="Analysezeitraum"><option value={30}>30 Tage</option><option value={90}>90 Tage</option><option value={180}>180 Tage</option><option value={365}>365 Tage</option></select><Link className="button secondary" href="/trainer/spieler">Spielerübersicht</Link><Link className="button" href="/trainer/ai-coach">AI Coach</Link></div></section>

    <section className="coach-overview-grid">
      <article className="card"><small>Average</small><strong>{metric(analytics?.metrics.average ?? 0)}</strong><Delta value={deltas.get("average")?.delta}/></article>
      <article className="card"><small>First 9</small><strong>{metric(analytics?.metrics.first9 ?? 0)}</strong><Delta value={deltas.get("first9")?.delta}/></article>
      <article className="card"><small>Checkoutquote</small><strong>{metric(analytics?.metrics.checkoutRate ?? 0, " %")}</strong><Delta value={deltas.get("checkoutRate")?.delta} unit="%-Pkt."/></article>
      <article className="card"><small>Trefferquote</small><strong>{metric(analytics?.metrics.hitRate ?? 0, " %")}</strong><Delta value={deltas.get("hitRate")?.delta} unit="%-Pkt."/></article>
      <article className="card"><small>Cricket MPR</small><strong>{metric(analytics?.metrics.mpr ?? 0)}</strong><Delta value={deltas.get("mpr")?.delta}/></article>
      <article className="card"><small>Highscore</small><strong>{metric(analytics?.metrics.highScore ?? 0)}</strong><span>{analytics?.metrics.zeroVisits ?? 0} Nullaufnahmen</span></article>
      <article className="card"><small>Trainingstage</small><strong>{analytics?.overview.activeDays ?? 0}</strong><span>{analytics?.overview.sessions ?? 0} Einheiten</span></article>
      <article className="card"><small>Leistungsindex</small><strong>{profile?.performanceIndex ?? 0}</strong><span>Level {level}</span></article>
    </section>

    <section className="coach-analysis-grid">
      <article className="card"><span className="eyebrow">Stärkste Entwicklung</span><h2>{analytics?.comparison.strongestImprovement?.label ?? "Noch kein Vergleich"}</h2><p>{analytics?.comparison.hasComparison ? "Größter positiver Unterschied zum vorherigen Zeitraum." : "Für einen Trend werden Daten im vorherigen Zeitraum benötigt."}</p><Delta value={analytics?.comparison.strongestImprovement?.delta} unit={analytics?.comparison.strongestImprovement?.unit}/></article>
      <article className="card"><span className="eyebrow">Größter Rückgang</span><h2>{analytics?.comparison.biggestDecline?.label ?? "Noch kein Vergleich"}</h2><p>{analytics?.comparison.hasComparison ? "Dieser Bereich benötigt aktuell die meiste Aufmerksamkeit." : "Noch keine belastbare Vergleichsbasis vorhanden."}</p><Delta value={analytics?.comparison.biggestDecline?.delta} unit={analytics?.comparison.biggestDecline?.unit}/></article>
    </section>

    <section className="card"><div className="section-heading"><div><span className="eyebrow">Formkurve</span><h2>Scoreentwicklung der letzten {analytics?.trend.length ?? 0} aktiven Tage</h2></div></div>{analytics?.trend.length ? <div style={{ display: "grid", gridTemplateColumns: `repeat(${analytics.trend.length}, minmax(8px, 1fr))`, alignItems: "end", gap: 6, minHeight: 190 }}>{analytics.trend.map((point) => <div key={point.date} title={`${point.date}: ${point.average} AVG · ${point.visits} Aufnahmen`} style={{ height: `${Math.max(8, point.average / trendMax * 170)}px`, borderRadius: 6, background: "linear-gradient(180deg, #ff2d3d, rgba(255,45,61,.28))" }} />)}</div> : <p>Noch keine Scorewerte für eine Formkurve vorhanden.</p>}</section>

    <section className="coach-analysis-grid">
      <article className="card"><span className="eyebrow">Verbesserte Ziele</span><h2>Hier geht es aufwärts</h2>{analytics?.comparison.improvingTargets.length ? analytics.comparison.improvingTargets.map((item) => <div className="player-insight-row" key={`${item.category}:${item.targetKey}`}><div><strong>{item.targetKey}</strong><small>{item.successes} / {item.attempts} aktuell</small></div><Delta value={item.delta} unit="%-Pkt."/></div>) : <p>Noch keine Ziele mit belastbarem positivem Trend.</p>}</article>
      <article className="card"><span className="eyebrow">Rückläufige Ziele</span><h2>Hier genauer hinschauen</h2>{analytics?.comparison.decliningTargets.length ? analytics.comparison.decliningTargets.map((item) => <div className="player-insight-row" key={`${item.category}:${item.targetKey}`}><div><strong>{item.targetKey}</strong><small>{item.successes} / {item.attempts} aktuell</small></div><Delta value={item.delta} unit="%-Pkt."/></div>) : <p>Keine belastbaren negativen Zieltrends erkannt.</p>}</article>
    </section>

    <section className="card"><div className="section-heading"><div><span className="eyebrow">Automatisch erkannt</span><h2>Die nächsten drei Trainingshebel</h2></div></div><div className="coach-recommendation-grid">{analytics?.comparison.focusTargets.length ? analytics.comparison.focusTargets.map((focus) => <article key={`${focus.category}:${focus.targetKey}`}><h3>{focus.targetKey} gezielt verbessern</h3><p>{focus.reason}</p><div>{focus.exerciseNames.map((name) => <span key={name}>{name}</span>)}</div></article>) : <p>Für automatische Zielschwerpunkte werden mindestens sechs Versuche pro Ziel benötigt.</p>}</div></section>

    <section className="coach-analysis-grid"><Heatmap title="Doppel D1–D20" items={targetsByCategory.get("DOUBLE") ?? []}/><Heatmap title="Treble T1–T20" items={targetsByCategory.get("TREBLE") ?? []}/><Heatmap title="Singles S1–S20" items={targetsByCategory.get("SINGLE") ?? []}/><Heatmap title="Bull" items={targetsByCategory.get("BULL") ?? []}/></section>
    <Heatmap title="Konkrete Checkoutwerte" items={targetsByCategory.get("CHECKOUT") ?? []}/>

    <section className="coach-analysis-grid"><article className="card"><span className="eyebrow">Checkoutbereiche</span><h2>Erfolg nach Finishhöhe</h2>{analytics?.checkoutRanges.length ? analytics.checkoutRanges.map((item) => <div className="player-insight-row" key={item.range}><div><strong>{item.range}</strong><small>{item.successes} von {item.attempts}</small></div><span>{item.rate} %</span></div>) : <p>Noch keine Checkout-Ziele mit Zielwert erfasst.</p>}</article><article className="card"><span className="eyebrow">Trainingsverteilung</span><h2>Verwendete Engines</h2>{analytics?.engineDistribution.length ? analytics.engineDistribution.slice(0, 8).map((item) => <div className="player-insight-row" key={item.engine}><strong>{item.engine}</strong><span>{item.count}</span></div>) : <p>Noch keine Engine-Daten.</p>}</article></section>

    <section className="card player-v3-summary"><span className="eyebrow">Persönlicher Coach</span><h2>{profile?.summary ?? "Noch keine belastbare Analyse vorhanden."}</h2><div className="player-v3-strengths"><div><small>Stärkster Bereich</small><strong>{profile?.strongest[0]?.label ?? "Noch offen"}</strong></div><div><small>Größter Hebel</small><strong>{profile?.weakest[0]?.label ?? "Mehr Daten sammeln"}</strong></div></div></section>

    <section className="card"><div className="section-heading"><div><span className="eyebrow">Skill-Profil</span><h2>Leistungsbereiche</h2></div></div><div className="coach-area-list">{(profile?.areas ?? []).map((area) => <div key={area.key} className="coach-area-row"><div><strong>{area.label}</strong><small>{area.samples} Datenpunkte · Trend {area.trend > 0 ? "+" : ""}{area.trend}</small></div><div className="coach-area-track"><i style={{ width: `${area.value}%` }} /></div><b>{area.value}</b></div>)}</div></section>

    <section className="card"><div className="section-heading"><div><span className="eyebrow">Empfehlungen</span><h2>Nächste Trainingsschwerpunkte</h2></div></div><div className="coach-recommendation-grid">{(profile?.recommendations ?? []).map((recommendation) => <article key={recommendation.area}><h3>{recommendation.title}</h3><p>{recommendation.reason}</p><div>{recommendation.exerciseNames.map((name) => <span key={name}>{name}</span>)}</div></article>)}{!profile?.recommendations.length && <p>Nach weiteren Trainingseinheiten entstehen hier persönliche Empfehlungen.</p>}</div></section>
  </main>;
}
