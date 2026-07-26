"use client";

import { useEffect, useMemo, useState } from "react";
import TrainingIntelligence, { type TrainingIntelligenceData } from "@/components/coach/TrainingIntelligence";
import WeeklyChallenge, { type WeeklyChallengeData } from "@/components/coach/WeeklyChallenge";
import "./styles.css";

type Area = { key: string; label: string; value: number; trend: number; samples: number };
type Recommendation = { area: string; title: string; reason: string; exerciseNames: string[] };
type Profile = {
  playerId: number;
  playerName: string;
  resultCount: number;
  activeDays: number;
  performanceIndex: number;
  areas: Area[];
  strongest: Area[];
  weakest: Area[];
  recommendations: Recommendation[];
  summary: string;
  weeklyChallenge: WeeklyChallengeData;
};
type ResponseData = {
  generatedAt: string;
  overview: { players: number; improving: number; declining: number; analyzedResults: number; focus: { label: string; count: number }[] };
  trainingIntelligence: TrainingIntelligenceData;
  profiles: Profile[];
};

export default function AiCoachPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/trainer/ai-coach");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analyse konnte nicht geladen werden.");
      setData(result);
      setSelectedId((current) => current ?? result.profiles?.[0]?.playerId ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analyse konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const profile = useMemo(() => data?.profiles.find((item) => item.playerId === selectedId) ?? null, [data, selectedId]);

  return (
    <main className="coach-page">
      <header className="coach-header">
        <div>
          <span className="eyebrow">Trainer Intelligence</span>
          <h1>AI Coach</h1>
          <p>Regelbasierte Leistungsanalyse aus Vereins- und Heimtraining der letzten 90 Tage.</p>
        </div>
        <button className="button secondary" onClick={() => void load()} disabled={loading}>{loading ? "Analysiert …" : "Neu analysieren"}</button>
      </header>

      {error && <section className="card coach-error"><strong>Analyse nicht verfügbar</strong><p>{error}</p></section>}
      {loading && !data ? <CoachSkeleton /> : data && (
        <>
          <section className="coach-kpis">
            <Kpi label="Spieler analysiert" value={data.overview.players} />
            <Kpi label="Ergebnisse" value={data.overview.analyzedResults} />
            <Kpi label="Mit Aufwärtstrend" value={data.overview.improving} positive />
            <Kpi label="Mit Warnsignal" value={data.overview.declining} warning />
          </section>

          <TrainingIntelligence data={data.trainingIntelligence} />

          <section className="coach-focus card">
            <div><span className="eyebrow">Vereinsfokus</span><h2>Empfohlene Schwerpunkte</h2></div>
            <div className="coach-focus-list">
              {data.overview.focus.length ? data.overview.focus.map((item) => <span key={item.label}><strong>{item.label}</strong><small>{item.count} Spieler</small></span>) : <p>Noch keine belastbaren Vereinsschwerpunkte vorhanden.</p>}
            </div>
          </section>

          <section className="coach-player-tabs" aria-label="Spieler auswählen">
            {data.profiles.map((item) => <button key={item.playerId} className={item.playerId === selectedId ? "is-active" : ""} onClick={() => setSelectedId(item.playerId)}><strong>{item.playerName}</strong><small>{item.resultCount} Ergebnisse</small></button>)}
          </section>

          {profile ? <PlayerAnalysis profile={profile} /> : <section className="card coach-empty"><h2>Noch keine Spieleranalyse</h2><p>Sobald Trainingsergebnisse gespeichert wurden, erscheint hier das Leistungsprofil.</p></section>}
        </>
      )}
    </main>
  );
}

function PlayerAnalysis({ profile }: { profile: Profile }) {
  return <section className="coach-analysis">
    <article className="card coach-score-card">
      <div><span className="eyebrow">Leistungsindex</span><h2>{profile.playerName}</h2><p>{profile.summary}</p></div>
      <strong className="coach-index">{profile.performanceIndex}</strong>
      <small>von 1000 Punkten</small>
      <div className="coach-meta"><span>{profile.activeDays} Trainingstage</span><span>{profile.resultCount} Ergebnisse</span></div>
    </article>

    <article className="card coach-areas">
      <div className="section-heading"><div><span className="eyebrow">Leistungsprofil</span><h2>Disziplinen</h2></div></div>
      {profile.areas.map((area) => <div className="coach-area" key={area.key}>
        <div><strong>{area.label}</strong><span className={area.trend > 2 ? "trend-up" : area.trend < -2 ? "trend-down" : "trend-stable"}>{area.trend > 0 ? "+" : ""}{area.trend}</span></div>
        <div className="coach-bar"><i style={{ width: `${area.value}%` }} /></div>
        <b>{area.value}</b>
      </div>)}
    </article>

    <WeeklyChallenge challenge={profile.weeklyChallenge} />

    <article className="card coach-strengths">
      <span className="eyebrow">Stärken & Schwächen</span>
      <div className="coach-two-columns">
        <div><h3>Stärkste Bereiche</h3>{profile.strongest.map((area) => <p key={area.key}><strong>{area.label}</strong><span>{area.value}/100</span></p>)}</div>
        <div><h3>Größte Hebel</h3>{profile.weakest.map((area) => <p key={area.key}><strong>{area.label}</strong><span>{area.value}/100</span></p>)}</div>
      </div>
    </article>

    <article className="card coach-recommendations">
      <span className="eyebrow">Coach-Empfehlungen</span>
      <h2>Nächste Trainingsschritte</h2>
      <div className="coach-recommendation-grid">
        {profile.recommendations.length ? profile.recommendations.map((item) => <section key={item.area}>
          <h3>{item.title}</h3><p>{item.reason}</p>
          <div>{item.exerciseNames.map((name) => <span key={name}>{name}</span>)}</div>
        </section>) : <p>Für konkrete Empfehlungen werden weitere Ergebnisse benötigt.</p>}
      </div>
    </article>
  </section>;
}

function Kpi({ label, value, positive, warning }: { label: string; value: number; positive?: boolean; warning?: boolean }) {
  return <article className={`card coach-kpi ${positive ? "is-positive" : ""} ${warning ? "is-warning" : ""}`}><small>{label}</small><strong>{value}</strong></article>;
}

function CoachSkeleton() {
  return <div className="coach-skeleton"><div /><div /><div /><div /><section /></div>;
}
