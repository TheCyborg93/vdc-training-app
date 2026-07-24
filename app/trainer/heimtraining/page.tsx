"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Player = { id: number; displayName: string };
type Exercise = { id: number; name: string; description: string; defaultMinutes: number; categories: { category: { name: string } }[] };
type Plan = { id: number; playerId: number; title: string; goal: string; durationMin: number; planJson: unknown; player?: Player; updatedAt: string };
type Item = { exerciseId: number; durationMin: number };

const goals = ["Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konstanz", "Wurftechnik", "Matchtraining"];

export default function TrainerHomeTrainingPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [playerId, setPlayerId] = useState<number | "">("");
  const [goal, setGoal] = useState("Scoring");
  const [duration, setDuration] = useState(45);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/home-training", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Daten konnten nicht geladen werden.");
    setPlayers(data.players ?? []);
    setExercises(data.exercises ?? []);
    setPlans(data.plans ?? []);
    if (!playerId && data.players?.length) setPlayerId(data.players[0].id);
  }

  useEffect(() => { void load(); }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.durationMin, 0), [items]);

  function generate() {
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) return setMessage("Lege zuerst passende Übungen im Übungskatalog an.");
    const generated: Item[] = [];
    let remaining = duration;
    let index = 0;
    while (remaining > 0 && index < pool.length * 4) {
      const exercise = pool[index % pool.length];
      const minutes = Math.min(exercise.defaultMinutes, remaining);
      if (minutes > 0) generated.push({ exerciseId: exercise.id, durationMin: minutes });
      remaining -= minutes;
      index += 1;
    }
    setItems(generated);
    setTitle(`${goal}-Heimtraining · ${duration} Minuten`);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/home-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, title, goal, durationMin: duration, items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setMessage("Heimtrainingsplan wurde zugewiesen.");
      setItems([]);
      setTitle("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="dashboard-page">
    <section className="dashboard-heading"><div><div className="eyebrow">Trainerbereich</div><h1>Heimtraining</h1><p>Individuelle Pläne erstellen und Spielern direkt zuweisen.</p></div></section>
    <section className="player-admin-layout">
      <form className="admin-form card" onSubmit={save}>
        <label>Spieler<select value={playerId} onChange={(e) => setPlayerId(Number(e.target.value))}>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>
        <label>Trainingsziel<select value={goal} onChange={(e) => setGoal(e.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Dauer<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[30,45,60,75,90].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label>
        <button type="button" className="button secondary" onClick={generate}>Plan automatisch erstellen</button>
        <label>Titel<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Übung hinzufügen<select defaultValue="" onChange={(e) => { const id = Number(e.target.value); const exercise = exercises.find((item) => item.id === id); if (exercise) setItems((current) => [...current, { exerciseId: id, durationMin: exercise.defaultMinutes }]); e.target.value = ""; }}><option value="">Übung auswählen …</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
        <div className={`plan-duration ${total === duration ? "is-valid" : ""}`}><strong>{total} / {duration} Minuten</strong><span>{total === duration ? "Dauer passt" : total < duration ? `${duration-total} Minuten fehlen` : `${total-duration} Minuten zu lang`}</span></div>
        <button className="button" disabled={saving || !items.length}>{saving ? "Speichert …" : "Plan zuweisen"}</button>
        {message && <p className="form-message">{message}</p>}
      </form>
      <section>
        <div className="section-heading"><div><span className="eyebrow">Planvorschau</span><h2>{items.length} Übungen</h2></div></div>
        <div className="plan-item-list">{items.length === 0 ? <div className="card"><p>Noch kein Plan erzeugt.</p></div> : items.map((item, index) => { const exercise = exercises.find((entry) => entry.id === item.exerciseId); return <article className="plan-item" key={`${item.exerciseId}-${index}`}><span className="drag-handle">{index+1}</span><div><strong>{exercise?.name}</strong><p>{exercise?.description}</p></div><input type="number" min="1" value={item.durationMin} onChange={(e) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, durationMin: Number(e.target.value) } : entry))}/><button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Entfernen</button></article>; })}</div>
      </section>
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Zugewiesen</span><h2>{plans.length} Heimtrainingspläne</h2></div></div><div className="saved-plan-grid">{plans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.player?.displayName ?? "Spieler"}</span><h3>{plan.title}</h3><p>{plan.goal} · {plan.durationMin} Minuten</p></article>)}</div></section>
  </main>;
}
