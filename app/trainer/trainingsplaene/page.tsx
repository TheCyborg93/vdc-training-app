"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppFeedback } from "@/components/ui/app-feedback";
import styles from "./training-plans.module.css";

type Exercise = {
  id: number;
  name: string;
  description: string;
  defaultMinutes: number;
  active: boolean;
  difficulty?: number;
  engine?: string;
  categories: { category: { name: string } }[];
};
type PlanItem = { exerciseId: number; durationMin: number };
type SavedPlan = {
  id: number;
  title: string;
  goal: string;
  durationMin: number;
  status: string;
  exercises: { id: number; durationMin: number; exercise: Exercise }[];
};

const goals = ["Aufwärmen", "Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konzentration", "Wurftechnik", "Matchtraining"];
const durations = [30, 45, 60, 75, 90, 105, 120];

function categoryOf(exercise: Exercise) {
  return exercise.categories[0]?.category.name ?? "Allgemein";
}

export default function TrainingPlansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, notify } = useAppFeedback();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [autoOpenedId, setAutoOpenedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("Scoring");
  const [duration, setDuration] = useState(90);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("Alle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const [exerciseResponse, planResponse] = await Promise.all([
        fetch("/api/exercises", { cache: "no-store" }),
        fetch("/api/training-plans", { cache: "no-store" }),
      ]);
      const exerciseData = await exerciseResponse.json();
      const planData = await planResponse.json();
      if (!exerciseResponse.ok) throw new Error(exerciseData.error ?? "Übungen konnten nicht geladen werden.");
      if (!planResponse.ok) throw new Error(planData.error ?? "Trainingspläne konnten nicht geladen werden.");
      setExercises(Array.isArray(exerciseData.exercises) ? exerciseData.exercises.filter((item: Exercise) => item.active) : []);
      setPlans(Array.isArray(planData) ? planData : []);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Daten konnten nicht geladen werden.";
      setMessage(text);
      notify("Laden fehlgeschlagen", { message: text, tone: "error" });
    }
  }

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    const requestedId = Number(searchParams.get("edit"));
    if (!Number.isInteger(requestedId) || requestedId <= 0 || autoOpenedId === requestedId || plans.length === 0) return;
    const requestedPlan = plans.find((plan) => plan.id === requestedId && plan.status === "DRAFT");
    if (!requestedPlan) return;
    editPlan(requestedPlan, searchParams.get("source") === "ai");
    setAutoOpenedId(requestedId);
    router.replace("/trainer/trainingsplaene", { scroll: false });
  }, [autoOpenedId, plans, router, searchParams]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.durationMin, 0), [items]);
  const difference = duration - total;
  const categories = useMemo(() => ["Alle", ...Array.from(new Set(exercises.map(categoryOf))).sort()], [exercises]);
  const filteredExercises = useMemo(() => {
    const search = catalogSearch.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const matchesCategory = catalogCategory === "Alle" || categoryOf(exercise) === catalogCategory;
      const matchesSearch = !search || exercise.name.toLowerCase().includes(search) || exercise.description.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategory, catalogSearch, exercises]);
  const draftPlans = plans.filter((plan) => plan.status === "DRAFT");
  const publishedPlans = plans.filter((plan) => plan.status === "PUBLISHED");

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setGoal("Scoring");
    setDuration(90);
    setItems([]);
    setMessage("");
  }

  function editPlan(plan: SavedPlan, fromAiCoach = false) {
    if (plan.status !== "DRAFT") return;
    setEditingId(plan.id);
    setTitle(plan.title);
    setGoal(plan.goal);
    setDuration(plan.durationMin);
    setItems(plan.exercises.map((item) => ({ exerciseId: item.exercise.id, durationMin: item.durationMin })));
    notify(fromAiCoach ? "AI-Coach-Entwurf geöffnet" : "Entwurf geöffnet", { message: "Reihenfolge, Übungen und Dauer können direkt angepasst werden.", tone: "info" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addExercise(exerciseId: number, atIndex?: number) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setItems((current) => {
      const next = [...current];
      const item = { exerciseId, durationMin: exercise.defaultMinutes };
      if (typeof atIndex === "number") next.splice(atIndex, 0, item);
      else next.push(item);
      return next;
    });
  }

  function generatePlan() {
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) return notify("Keine Übungen verfügbar", { message: "Lege zuerst Übungen im Katalog an.", tone: "warning" });
    const generated: PlanItem[] = [];
    let remaining = duration;
    let index = 0;
    while (remaining > 0 && index < pool.length * 3) {
      const exercise = pool[index % pool.length];
      const minutes = Math.min(Math.max(5, exercise.defaultMinutes), remaining);
      generated.push({ exerciseId: exercise.id, durationMin: minutes });
      remaining -= minutes;
      index += 1;
    }
    setItems(generated);
    if (!title) setTitle(`${goal}-Training · ${duration} Minuten`);
    notify("Planvorschlag erstellt", { message: `${generated.length} Übungen wurden passend zum Zeitbudget verteilt.`, tone: "success" });
  }

  function balanceDurations() {
    if (!items.length) return;
    const base = Math.floor(duration / items.length);
    let remainder = duration - base * items.length;
    setItems((current) => current.map((item) => ({ ...item, durationMin: base + (remainder-- > 0 ? 1 : 0) })));
    notify("Zeitbudget ausgeglichen", { message: `${duration} Minuten wurden auf ${items.length} Übungen verteilt.`, tone: "success" });
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function reorder(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setItems((current) => {
      const copy = [...current];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    setDragIndex(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!items.length) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/training-plans/${editingId}` : "/api/training-plans", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goal, durationMin: duration, items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      notify(editingId ? "Entwurf aktualisiert" : "Trainingsplan gespeichert", { message: "Der Plan ist in der Bibliothek verfügbar.", tone: "success" });
      resetForm();
      await loadData();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      setMessage(text);
      notify("Speichern fehlgeschlagen", { message: text, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan: SavedPlan) {
    if (plan.status !== "DRAFT") return;
    if (!(await confirm({ title: "Trainingsplan löschen?", message: `Der Entwurf „${plan.title}“ wird dauerhaft gelöscht.`, confirmLabel: "Entwurf löschen", cancelLabel: "Behalten", destructive: true }))) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/training-plans/${plan.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen.");
      if (editingId === plan.id) resetForm();
      await loadData();
      notify("Entwurf gelöscht", { message: plan.title, tone: "success" });
    } catch (error) {
      notify("Löschen fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.root} phase6-builder-page`}>
      <header className="phase6-builder-hero">
        <div><span>TRAININGSPLAN BUILDER V3</span><h1>{editingId ? "Entwurf bearbeiten" : "Training zusammenstellen"}</h1><p>Übungen auswählen, Zeit verteilen und den Ablauf direkt für den Trainingstag vorbereiten.</p></div>
        <div><button type="button" onClick={generatePlan}>Automatisch erstellen</button><Link href="/trainer/trainingstag">Zum Trainingstag</Link></div>
      </header>

      <form onSubmit={save} className="phase6-builder-shell">
        <section className="phase6-builder-meta">
          <label><span>Planname</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Checkout unter Druck" /></label>
          <label><span>Trainingsziel</span><select value={goal} onChange={(event) => setGoal(event.target.value)}>{goals.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
          <div className="phase6-duration-tabs">{durations.map((value) => <button type="button" className={duration === value ? "is-active" : ""} key={value} onClick={() => setDuration(value)}>{value}<small>Min.</small></button>)}</div>
        </section>

        <section className="phase6-builder-workspace">
          <aside className="phase6-exercise-catalog">
            <header><div><span>ÜBUNGSKATALOG</span><h2>{filteredExercises.length} Übungen</h2></div><Link href="/trainer/uebungen">Verwalten</Link></header>
            <input className="phase6-catalog-search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Übung suchen …" />
            <div className="phase6-category-tabs">{categories.map((entry) => <button type="button" className={catalogCategory === entry ? "is-active" : ""} key={entry} onClick={() => setCatalogCategory(entry)}>{entry}</button>)}</div>
            <div className="phase6-catalog-list">
              {filteredExercises.map((exercise) => <article key={exercise.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/exercise-id", String(exercise.id)); event.dataTransfer.effectAllowed = "copy"; }}>
                <div><small>{categoryOf(exercise)} · {exercise.defaultMinutes} Min.</small><strong>{exercise.name}</strong><p>{exercise.description}</p></div>
                <button type="button" onClick={() => addExercise(exercise.id)} aria-label={`${exercise.name} hinzufügen`}>+</button>
              </article>)}
              {!filteredExercises.length && <p className="phase6-catalog-empty">Keine passende Übung gefunden.</p>}
            </div>
          </aside>

          <section className="phase6-plan-canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = Number(event.dataTransfer.getData("text/exercise-id")); if (Number.isInteger(id)) addExercise(id); }}>
            <header><div><span>TRAININGSABLAUF</span><h2>{items.length} Übungen · {total} Minuten</h2></div><button type="button" onClick={balanceDurations} disabled={!items.length}>Zeit ausgleichen</button></header>
            <div className={`phase6-time-budget ${difference === 0 ? "is-valid" : difference < 0 ? "is-over" : ""}`}><div><span style={{ width: `${Math.min(100, Math.round(total / Math.max(duration, 1) * 100))}%` }} /></div><strong>{difference === 0 ? "Zeitbudget passt" : difference > 0 ? `${difference} Minuten frei` : `${Math.abs(difference)} Minuten zu lang`}</strong></div>

            {!items.length ? <div className="phase6-plan-empty"><strong>Noch keine Übungen</strong><p>Ziehe Übungen aus dem Katalog hierher oder erstelle einen automatischen Vorschlag.</p><button type="button" onClick={generatePlan}>Vorschlag erstellen</button></div> : <div className="phase6-plan-list">
              {items.map((item, index) => {
                const exercise = exercises.find((entry) => entry.id === item.exerciseId);
                if (!exercise) return null;
                return <article key={`${item.exerciseId}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); reorder(index); }}>
                  <span className="phase6-plan-order">{String(index + 1).padStart(2, "0")}</span>
                  <div className="phase6-plan-copy"><small>{categoryOf(exercise)}</small><strong>{exercise.name}</strong><p>{exercise.description}</p></div>
                  <label><input type="number" min="1" value={item.durationMin} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, durationMin: Math.max(1, Number(event.target.value)) } : entry))} /><span>Min.</span></label>
                  <div className="phase6-plan-actions"><button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</button><button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}>↓</button><button type="button" className="is-danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>
                </article>;
              })}
            </div>}
          </section>
        </section>

        <footer className="phase6-builder-footer">
          <div><span>{goal}</span><strong>{title || "Unbenannter Trainingsplan"}</strong><small>{items.length} Übungen · {total}/{duration} Minuten</small></div>
          <div>{editingId && <button type="button" onClick={resetForm}>Abbrechen</button>}<button className="is-primary" disabled={saving || !items.length || !title}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Als Entwurf speichern"}</button></div>
          {message && <p role="status">{message}</p>}
        </footer>
      </form>

      <section className="phase6-plan-library">
        <header><div><span>PLANBIBLIOTHEK</span><h2>Gespeicherte Trainingspläne</h2></div><strong>{draftPlans.length} Entwürfe · {publishedPlans.length} veröffentlicht</strong></header>
        <div className="phase6-library-grid">
          {[...draftPlans, ...publishedPlans].map((plan) => <article key={plan.id} className={plan.status === "PUBLISHED" ? "is-published" : ""}><header><span>{plan.status === "PUBLISHED" ? "Veröffentlicht" : "Entwurf"}</span><small>{plan.exercises.length} Übungen</small></header><h3>{plan.title}</h3><p>{plan.goal} · {plan.durationMin} Minuten</p><ol>{plan.exercises.slice(0, 4).map((item) => <li key={item.id}><span>{item.exercise.name}</span><b>{item.durationMin} Min.</b></li>)}</ol><footer>{plan.status === "DRAFT" ? <><button onClick={() => editPlan(plan)}>Bearbeiten</button><button className="is-danger" disabled={saving} onClick={() => void deletePlan(plan)}>Löschen</button></> : <Link href="/trainer/trainingstag">Für Trainingstag verwenden</Link>}</footer></article>)}
          {!plans.length && <div className="phase6-library-empty">Noch keine Trainingspläne gespeichert.</div>}
        </div>
      </section>
    </main>
  );
}
