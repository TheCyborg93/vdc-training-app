"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./training-plans.module.css";

type Exercise = { id: number; name: string; description: string; defaultMinutes: number; active: boolean; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number };
type SavedPlan = { id: number; title: string; goal: string; durationMin: number; status: string; exercises: { id: number; durationMin: number; exercise: Exercise }[] };

const goals = ["Aufwärmen", "Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konzentration", "Wurftechnik", "Matchtraining"];

export default function TrainingPlansPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("Scoring");
  const [duration, setDuration] = useState(90);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    const [exerciseResponse, planResponse] = await Promise.all([fetch("/api/exercises", { cache: "no-store" }), fetch("/api/training-plans", { cache: "no-store" })]);
    const exerciseData = await exerciseResponse.json();
    const planData = await planResponse.json();
    setExercises(Array.isArray(exerciseData.exercises) ? exerciseData.exercises.filter((item: Exercise) => item.active) : []);
    setPlans(Array.isArray(planData) ? planData : []);
  }

  useEffect(() => { void loadData(); }, []);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.durationMin, 0), [items]);
  const visiblePlans = plans.filter((plan) => plan.status !== "ARCHIVED");

  function resetForm() {
    setEditingId(null); setTitle(""); setGoal("Scoring"); setDuration(90); setItems([]); setMessage("");
  }

  function editPlan(plan: SavedPlan) {
    if (plan.status !== "DRAFT") return;
    setEditingId(plan.id); setTitle(plan.title); setGoal(plan.goal); setDuration(plan.durationMin);
    setItems(plan.exercises.map((item) => ({ exerciseId: item.exercise.id, durationMin: item.durationMin })));
    setMessage(`Entwurf „${plan.title}“ wird bearbeitet.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function generatePlan() {
    setMessage("");
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) return setMessage("Lege zuerst passende Übungen im Übungskatalog an.");
    const generated: PlanItem[] = [];
    let remaining = duration;
    let index = 0;
    while (remaining > 0 && index < pool.length * 3) {
      const exercise = pool[index % pool.length];
      const exerciseDuration = Math.min(exercise.defaultMinutes, remaining);
      if (exerciseDuration >= 5 || generated.length === 0) generated.push({ exerciseId: exercise.id, durationMin: exerciseDuration });
      remaining -= exerciseDuration; index += 1;
    }
    setItems(generated);
    if (!title) setTitle(`${goal}-Training · ${duration} Minuten`);
  }

  function addExercise(exerciseId: number) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise) setItems((current) => [...current, { exerciseId, durationMin: exercise.defaultMinutes }]);
  }

  function reorder(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setItems((current) => { const copy = [...current]; const [moved] = copy.splice(dragIndex, 1); copy.splice(targetIndex, 0, moved); return copy; });
    setDragIndex(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/training-plans/${editingId}` : "/api/training-plans", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, goal, durationMin: duration, items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setMessage(editingId ? "Entwurf wurde aktualisiert." : "Trainingsplan wurde als Entwurf gespeichert.");
      setEditingId(null); setItems([]); setTitle(""); await loadData();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function deletePlan(plan: SavedPlan) {
    if (plan.status !== "DRAFT" || !window.confirm(`Entwurf „${plan.title}“ wirklich löschen?`)) return;
    const response = await fetch(`/api/training-plans/${plan.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Löschen fehlgeschlagen.");
    if (editingId === plan.id) resetForm();
    setMessage("Entwurf wurde gelöscht."); await loadData();
  }

  return <main className={`${styles.root} dashboard-page`}>
    <section className="dashboard-heading"><div><div className="eyebrow">Trainerbereich</div><h1>Trainingspläne</h1><p>Entwürfe erstellen und bearbeiten. Veröffentlichte Pläne bleiben geschützt.</p></div><Link className="button secondary" href="/trainer/archiv">Archiv & Statistiken</Link></section>
    <section className="plan-builder-layout">
      <form className="admin-form card" onSubmit={save}>
        <div className="section-heading"><div><span className="eyebrow">{editingId ? "Bearbeiten" : "Generator"}</span><h2>{editingId ? "Entwurf anpassen" : "Plan erstellen"}</h2></div>{editingId && <button type="button" className="button secondary" onClick={resetForm}>Abbrechen</button>}</div>
        <label>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Trainingsziel<select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[30,45,60,75,90,105,120].map((item) => <option key={item} value={item}>{item} Minuten</option>)}</select></label>
        <button className="button secondary" type="button" onClick={generatePlan}>Plan automatisch erstellen</button>
        <label>Übung hinzufügen<select defaultValue="" onChange={(event) => { if (event.target.value) addExercise(Number(event.target.value)); event.target.value = ""; }}><option value="">Übung auswählen …</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
        <div className={`plan-duration ${total === duration ? "is-valid" : ""}`}><strong>{total} / {duration} Minuten</strong><span>{total === duration ? "Dauer passt" : total < duration ? `${duration-total} Minuten fehlen` : `${total-duration} Minuten zu lang`}</span></div>
        <button className="button" disabled={saving || items.length === 0}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Als Entwurf speichern"}</button>
        {message && <p className="form-message">{message}</p>}
      </form>
      <section><div className="section-heading"><div><span className="eyebrow">Ablauf</span><h2>Übungen anordnen</h2></div></div>{items.length === 0 ? <div className="card"><p>Noch keine Übungen im Plan.</p></div> : <div className="plan-item-list">{items.map((item, index) => { const exercise = exercises.find((entry) => entry.id === item.exerciseId); if (!exercise) return null; return <article className="plan-item" draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(index)} key={`${item.exerciseId}-${index}`}><span className="drag-handle">↕</span><div><strong>{index+1}. {exercise.name}</strong><p>{exercise.description}</p></div><input type="number" min="1" value={item.durationMin} onChange={(event) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, durationMin: Number(event.target.value) } : entry))}/><button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Entfernen</button></article>; })}</div>}</section>
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Aktiv</span><h2>{visiblePlans.length} Trainingspläne</h2></div></div><div className="saved-plan-grid">{visiblePlans.length === 0 ? <div className="card"><p>Noch kein Trainingsplan gespeichert.</p></div> : visiblePlans.map((plan) => <article className="saved-plan-card" key={plan.id}><span className="status">{plan.status === "DRAFT" ? "Entwurf" : "Veröffentlicht"}</span><h3>{plan.title}</h3><p>{plan.goal} · {plan.durationMin} Minuten · {plan.exercises.length} Übungen</p><ol>{plan.exercises.slice(0,4).map((item) => <li key={item.id}>{item.exercise.name} ({item.durationMin} Min.)</li>)}</ol>{plan.status === "DRAFT" && <div className="training-plan-card-actions"><button className="button secondary" onClick={() => editPlan(plan)}>Bearbeiten</button><button className="button secondary" onClick={() => void deletePlan(plan)}>Löschen</button></div>}</article>)}</div></section>
  </main>;
}
