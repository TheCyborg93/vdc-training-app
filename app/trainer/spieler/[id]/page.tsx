"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
  weeklyChallenge?: { title: string; description: string; progress: number; target: number; unit: string; completed: boolean };
};

type Player = { id: number; firstName: string; displayName: string; active: boolean };

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const playerId = Number(params.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [coachResponse, playersResponse] = await Promise.all([
          fetch("/api/trainer/ai-coach", { cache: "no-store" }),
          fetch("/api/players", { cache: "no-store" }),
        ]);
        const coachData = await coachResponse.json();
        const playersData = await playersResponse.json();
        if (!coachResponse.ok) throw new Error(coachData.error ?? "Leistungsprofil konnte nicht geladen werden.");
        if (!playersResponse.ok) throw new Error(playersData.error ?? "Spieler konnte nicht geladen werden.");
        setProfile((coachData.profiles ?? []).find((item: Profile) => item.playerId === playerId) ?? null);
        setPlayer((playersData ?? []).find((item: Player) => item.id === playerId) ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Profil konnte nicht geladen werden.");
      } finally { setLoading(false); }
    }
    if (Number.isInteger(playerId)) void load();
  }, [playerId]);

  const level = useMemo(() => Math.max(1, Math.floor((profile?.performanceIndex ?? 0) / 50) + 1), [profile?.performanceIndex]);
  const xp = profile?.performanceIndex ?? 0;
  const nextLevelXp = level * 50;

  if (loading) return <main className="dashboard-page"><div className="card"><p>Spielerprofil wird berechnet …</p></div></main>;
  if (error || !player) return <main className="dashboard-page"><div className="card"><h1>Profil nicht verfügbar</h1><p>{error || "Der Spieler wurde nicht gefunden."}</p><Link className="button secondary" href="/trainer/spieler">Zurück zu Spielern</Link></div></main>;

  return (
    <main className="dashboard-page player-profile-v3">
      <section className="dashboard-heading">
        <div><div className="eyebrow">Digitaler Dart-Zwilling</div><h1>{player.displayName}</h1><p>{player.firstName} · Profil wird automatisch aus Vereins- und Heimtraining aufgebaut.</p></div>
        <div className="actions"><Link className="button secondary" href="/trainer/spieler">Spielerübersicht</Link><Link className="button" href="/trainer/ai-coach">AI Coach</Link></div>
      </section>

      <section className="coach-overview-grid">
        <article className="card"><small>Leistungsindex</small><strong>{profile?.performanceIndex ?? 0}</strong><span>von 1000</span></article>
        <article className="card"><small>Trainingslevel</small><strong>Level {level}</strong><span>{xp} / {nextLevelXp} XP</span></article>
        <article className="card"><small>Trainingstage</small><strong>{profile?.activeDays ?? 0}</strong><span>letzte 90 Tage</span></article>
        <article className="card"><small>Aufnahmen</small><strong>{profile?.resultCount ?? 0}</strong><span>ausgewertet</span></article>
      </section>

      <section className="card player-v3-summary">
        <span className="eyebrow">Persönlicher Coach</span>
        <h2>{profile?.summary ?? "Noch keine belastbare Analyse vorhanden."}</h2>
        <div className="player-v3-strengths"><div><small>Stärkster Bereich</small><strong>{profile?.strongest[0]?.label ?? "Noch offen"}</strong></div><div><small>Größter Hebel</small><strong>{profile?.weakest[0]?.label ?? "Mehr Daten sammeln"}</strong></div></div>
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Skill-Profil</span><h2>Sechs Leistungsbereiche</h2></div></div>
        <div className="coach-area-list">
          {(profile?.areas ?? []).map((area) => <div key={area.key} className="coach-area-row"><div><strong>{area.label}</strong><small>{area.samples} Datenpunkte · Trend {area.trend > 0 ? "+" : ""}{area.trend}</small></div><div className="coach-area-track"><i style={{ width: `${area.value}%` }} /></div><b>{area.value}</b></div>)}
        </div>
      </section>

      <section className="coach-analysis-grid">
        <article className="card"><span className="eyebrow">Stärken</span><h2>Darauf kannst du aufbauen</h2>{profile?.strongest.length ? profile.strongest.map((area) => <div className="player-insight-row" key={area.key}><strong>{area.label}</strong><span>{area.value}/100</span></div>) : <p>Noch keine ausreichenden Daten.</p>}</article>
        <article className="card"><span className="eyebrow">Schwächen</span><h2>Hier liegt der größte Hebel</h2>{profile?.weakest.length ? profile.weakest.map((area) => <div className="player-insight-row" key={area.key}><strong>{area.label}</strong><span>{area.value}/100</span></div>) : <p>Noch keine ausreichenden Daten.</p>}</article>
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Engine V3</span><h2>Automatische Empfehlungen</h2></div></div>
        <div className="coach-recommendation-grid">
          {(profile?.recommendations ?? []).map((recommendation) => <article key={recommendation.area}><h3>{recommendation.title}</h3><p>{recommendation.reason}</p><div>{recommendation.exerciseNames.map((name) => <span key={name}>{name}</span>)}</div></article>)}
          {!profile?.recommendations.length && <p>Nach den nächsten Trainingseinheiten entstehen hier persönliche Empfehlungen.</p>}
        </div>
      </section>

      {profile?.weeklyChallenge && <section className="card"><span className="eyebrow">Wochenchallenge</span><h2>{profile.weeklyChallenge.title}</h2><p>{profile.weeklyChallenge.description}</p><div className="coach-area-track"><i style={{ width: `${Math.min(100, profile.weeklyChallenge.progress / Math.max(profile.weeklyChallenge.target, 1) * 100)}%` }} /></div><strong>{profile.weeklyChallenge.progress} / {profile.weeklyChallenge.target} {profile.weeklyChallenge.unit}</strong></section>}
    </main>
  );
}
