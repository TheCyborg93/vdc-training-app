"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Player = { id: number; displayName: string };
type Area = { key: string; label: string; value: number; trend: number; samples: number };
type Block = {
  position: number;
  exerciseId: number;
  exerciseName: string;
  durationMin: number;
  area: string;
  difficultyLevel: number;
  intensityLevel: number;
  reason: string;
  configuration: Record<string, unknown>;
};
type AdaptiveResponse = {
  player: { id: number; name: string };
  dataBasis: { periodDays: number; results: number; activeDays: number; resultsLast7: number; activeDaysLast7: number };
  profile: { performanceIndex: number; strongest: Area[]; weakest: Area[] };
  session: {
    durationMin: number;
    difficultyLevel: number;
    workload: "RECOVERY" | "NORMAL" | "INTENSIVE";
    confidence: number;
    focusAreas: string[];
    blocks: Block[];
    explanation: string;
  };
};

const workloadLabel = {
  RECOVERY: "Regeneration",
  NORMAL: "Normal",
  INTENSIVE: "Intensiv",
};

function configurationLabel(configuration: Record<string, unknown>) {
  const entries = Object.entries(configuration);
  return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "Standardkonfiguration";
}

export default function AdaptiveCoachPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [durationMin, setDurationMin] = useState(90);
  const [data, setData] = useState<AdaptiveResponse | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");

  useEffect(() => {
    fetch("/api/players", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : [];
        setPlayers(list);
        if (list[0]) setPlayerId(String(list[0].id));
      })
      .catch(() => setPlayers([]));
  }, []);

  async function generate() {
    if (!playerId) return;
    setLoading(true);
    setError("");
    setSaveMessage("");
    setSavedPlanId(null);
    try {
      const response = await fetch(`/api/trainer/ai-coach/adaptive?playerId=${playerId}&durationMin=${durationMin}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Plan konnte nicht erstellt werden.");
      setData(payload);
      setBlocks(payload.session.blocks ?? []);
      setPlanTitle(`Adaptiv · ${payload.player.name} · ${durationMin} Min.`);
      setPlanGoal((payload.session.focusAreas ?? []).join(" & ") || "Individuelle Entwicklung");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Plan konnte nicht erstellt werden.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAsTrainingPlan() {
    if (!data || !blocks.length) return;
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const response = await fetch("/api/training-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: planTitle,
          goal: planGoal,
          durationMin: totalMinutes,
          items: blocks.map((block) => ({
            exerciseId: block.exerciseId,
            durationMin: block.durationMin,
            settingsJson: {
              source: "ADAPTIVE_COACH",
              playerId: data.player.id,
              playerName: data.player.name,
              area: block.area,
              difficultyLevel: block.difficultyLevel,
              intensityLevel: block.intensityLevel,
              coachReason: block.reason,
              coachConfidence: data.session.confidence,
              workload: data.session.workload,
              configuration: block.configuration,
            },
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Trainingsplan konnte nicht gespeichert werden.");
      setSavedPlanId(payload.id);
      setSaveMessage("Der adaptive Trainingsplan wurde als Entwurf gespeichert.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Trainingsplan konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (playerId) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const totalMinutes = useMemo(() => blocks.reduce((sum, block) => sum + block.durationMin, 0), [blocks]);

  function changeDuration(index: number, next: number) {
    setBlocks((current) => current.map((block, blockIndex) => blockIndex === index ? { ...block, durationMin: Math.max(5, next) } : block));
    setSavedPlanId(null);
    setSaveMessage("");
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index).map((block, blockIndex) => ({ ...block, position: blockIndex + 1 })));
    setSavedPlanId(null);
    setSaveMessage("");
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy.map((block, blockIndex) => ({ ...block, position: blockIndex + 1 }));
    });
    setSavedPlanId(null);
    setSaveMessage("");
  }

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div>
        <div className="eyebrow">Phase 7.3.2 · Adaptive Trainingsintelligenz</div>
        <h1>Adaptiver Coach</h1>
        <p>Individueller Trainingsplan aus Leistungsdaten, Belastung, Trends und Übungsrotation.</p>
      </div>
      <div className="analysis-heading-actions">
        <Link className="button secondary" href="/trainer/ai-coach">Coach Dashboard</Link>
        {data?.player ? <Link className="button" href={`/trainer/spieler/${data.player.id}`}>Spieleranalyse</Link> : null}
      </div>
    </section>

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Plan erstellen</span><h2>Spieler und Dauer auswählen</h2></div></div>
      <div className="analysis-form-grid is-three">
        <label>Spieler<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Spieler wählen</option>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>
        <label>Dauer<select value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))}><option value={30}>30 Minuten</option><option value={45}>45 Minuten</option><option value={60}>60 Minuten</option><option value={90}>90 Minuten</option><option value={120}>120 Minuten</option><option value={150}>150 Minuten</option><option value={180}>180 Minuten</option></select></label>
        <button className="button" type="button" onClick={() => void generate()} disabled={!playerId || loading}>{loading ? "Wird berechnet …" : "Plan neu berechnen"}</button>
      </div>
      {error ? <div className="analysis-message is-error" role="alert">{error}</div> : null}
    </section>

    {data ? <>
      <section className="analysis-kpis">
        <article><small>Coach Score</small><strong>{data.profile.performanceIndex}</strong><span>persönlicher Leistungsindex</span></article>
        <article><small>Sicherheit</small><strong>{data.session.confidence} %</strong><span>{data.dataBasis.results} Ergebnisse</span></article>
        <article><small>Schwierigkeit</small><strong>Level {data.session.difficultyLevel}</strong><span>adaptiv berechnet</span></article>
        <article><small>Belastung</small><strong>{workloadLabel[data.session.workload]}</strong><span>{data.dataBasis.activeDaysLast7} Trainingstage in 7 Tagen</span></article>
        <article><small>Planzeit</small><strong>{totalMinutes}</strong><span>von {durationMin} Minuten</span></article>
      </section>

      <section className="coach-analysis-grid">
        <article className="card"><span className="eyebrow">Stärken</span><h2>Aktuell stabil</h2>{data.profile.strongest.map((area) => <div className="player-insight-row" key={area.key}><div><strong>{area.label}</strong><small>{area.samples} Datenpunkte</small></div><span>{area.value}/100</span></div>)}</article>
        <article className="card"><span className="eyebrow">Schwerpunkte</span><h2>Heute priorisieren</h2>{data.profile.weakest.map((area) => <div className="player-insight-row" key={area.key}><div><strong>{area.label}</strong><small>Trend {area.trend > 0 ? "+" : ""}{area.trend}</small></div><span>{area.value}/100</span></div>)}</article>
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Coach-Begründung</span><h2>Warum dieser Plan?</h2></div></div>
        <p>{data.session.explanation}</p>
        <div className="analysis-chip-list">{data.session.focusAreas.map((area) => <span key={area}>{area}</span>)}</div>
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Als Entwurf speichern</span><h2>Trainingsplan übernehmen</h2></div></div>
        <div className="analysis-form-grid is-plan">
          <label>Planname<input value={planTitle} maxLength={120} onChange={(event) => setPlanTitle(event.target.value)} /></label>
          <label>Trainingsziel<input value={planGoal} maxLength={80} onChange={(event) => setPlanGoal(event.target.value)} /></label>
          <button className="button" type="button" onClick={() => void saveAsTrainingPlan()} disabled={saving || !blocks.length || planTitle.trim().length < 2 || planGoal.trim().length < 2}>{saving ? "Wird gespeichert …" : "Als Trainingsplan speichern"}</button>
        </div>
        {saveMessage ? <div className="analysis-message is-success">{saveMessage} {savedPlanId ? <Link href={`/trainer/trainingsplaene/${savedPlanId}`}>Entwurf öffnen →</Link> : null}</div> : null}
      </section>

      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">Editierbarer Ablauf</span><h2>Adaptive Trainingseinheit</h2></div><span className="analysis-count">{blocks.length} Blöcke · {totalMinutes} Min.</span></div>
        <div className="analysis-archive-list">
          {blocks.map((block, index) => <article className="analysis-training-card" key={`${block.exerciseId}-${index}`}>
            <header><div><small>Block {index + 1} · {block.area}</small><h2>{block.exerciseName}</h2><p>{block.reason}</p></div><span className="analysis-status"><i /> Level {block.difficultyLevel}</span></header>
            <div className="analysis-training-facts">
              <span><small>Dauer</small><strong>{block.durationMin} Min.</strong></span>
              <span><small>Schwierigkeit</small><strong>{block.difficultyLevel}/10</strong></span>
              <span><small>Intensität</small><strong>{block.intensityLevel}/10</strong></span>
              <span><small>Bereich</small><strong>{block.area}</strong></span>
            </div>
            <p><small>{configurationLabel(block.configuration)}</small></p>
            <div className="analysis-block-actions">
              <button className="button secondary" type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0}>Nach oben</button>
              <button className="button secondary" type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>Nach unten</button>
              <button className="button secondary" type="button" onClick={() => changeDuration(index, block.durationMin - 5)}>-5 Min.</button>
              <button className="button secondary" type="button" onClick={() => changeDuration(index, block.durationMin + 5)}>+5 Min.</button>
              <button className="button secondary" type="button" onClick={() => removeBlock(index)}>Entfernen</button>
            </div>
          </article>)}
        </div>
      </section>
    </> : <section className="card"><div className="analysis-empty"><strong>Noch kein Plan geladen</strong><p>Wähle einen Spieler, um einen adaptiven Trainingsplan zu erzeugen.</p></div></section>}
  </main>;
}
