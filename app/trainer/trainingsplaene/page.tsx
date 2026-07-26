"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppFeedback } from "@/components/ui/app-feedback";
import styles from "./training-plans.module.css";

type Exercise = { id: number; name: string; description: string; defaultMinutes: number; active: boolean; categories: { category: { name: string } }[] };
type PlanItem = { exerciseId: number; durationMin: number };
type SavedPlan = { id: number; title: string; goal: string; durationMin: number; status: string; exercises: { id: number; durationMin: number; exercise: Exercise }[] };

const goals = [
  { name: "Aufwärmen", icon: "↗", text: "Rhythmus und Gefühl aufbauen." },
  { name: "Scoring", icon: "◎", text: "Konstante und hohe Aufnahmen." },
  { name: "Doppel", icon: "◉", text: "Matchdoppel sicher treffen." },
  { name: "Checkout", icon: "✓", text: "Finishes stellen und abschließen." },
  { name: "Stellen", icon: "≡", text: "Saubere Wege zum Finish trainieren." },
  { name: "Mental", icon: "◇", text: "Fokus und Druckresistenz stärken." },
  { name: "Konzentration", icon: "⊙", text: "Präzision über längere Phasen." },
  { name: "Wurftechnik", icon: "↥", text: "Ablauf und Wiederholbarkeit verbessern." },
  { name: "Matchtraining", icon: "⚑", text: "Wettkampfsituationen simulieren." },
] as const;

const durations = [30, 45, 60, 75, 90, 105, 120];

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
  const draftPlans = plans.filter((plan) => plan.status === "DRAFT");
  const publishedPlans = plans.filter((plan) => plan.status === "PUBLISHED");
  const durationDifference = duration - total;
  const isAiDraft = title.startsWith("AI Coach ·");

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
    setMessage("");
    notify(fromAiCoach ? "AI-Coach-Entwurf geöffnet" : "Entwurf geöffnet", {
      message: fromAiCoach ? "Prüfe Reihenfolge und Dauer und passe den Vorschlag an euren Trainingstag an." : `„${plan.title}“ kann jetzt bearbeitet werden.`,
      tone: "info",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function generatePlan() {
    setMessage("");
    const matching = exercises.filter((exercise) => exercise.categories.some((link) => link.category.name.toLowerCase() === goal.toLowerCase()));
    const pool = matching.length ? matching : exercises;
    if (!pool.length) {
      const text = "Lege zuerst passende Übungen im Übungskatalog an.";
      setMessage(text);
      notify("Keine Übungen verfügbar", { message: text, tone: "warning" });
      return;
    }
    const generated: PlanItem[] = [];
    let remaining = duration;
    let index = 0;
    while (remaining > 0 && index < pool.length * 3) {
      const exercise = pool[index % pool.length];
      const exerciseDuration = Math.min(exercise.defaultMinutes, remaining);
      if (exerciseDuration >= 5 || generated.length === 0) generated.push({ exerciseId: exercise.id, durationMin: exerciseDuration });
      remaining -= exerciseDuration;
      index += 1;
    }
    setItems(generated);
    if (!title) setTitle(`${goal}-Training · ${duration} Minuten`);
    notify("Trainingsplan erstellt", { message: `${generated.length} Übungen wurden zusammengestellt.`, tone: "success" });
  }

  function addExercise(exerciseId: number) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise) setItems((current) => [...current, { exerciseId, durationMin: exercise.defaultMinutes }]);
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
    setSaving(true);
    setMessage("");
    const wasEditing = editingId !== null;
    try {
      const response = await fetch(editingId ? `/api/training-plans/${editingId}` : "/api/training-plans", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goal, durationMin: duration, items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      notify(wasEditing ? "Entwurf aktualisiert" : "Trainingsplan gespeichert", {
        message: wasEditing ? "Alle Änderungen wurden übernommen." : "Der Plan wurde als bearbeitbarer Entwurf gespeichert.",
        tone: "success",
      });
      setEditingId(null);
      setItems([]);
      setTitle("");
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
    const accepted = await confirm({
      title: "Trainingsplan löschen?",
      message: `Der Entwurf „${plan.title}“ wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmLabel: "Entwurf löschen",
      cancelLabel: "Behalten",
      destructive: true,
    });
    if (!accepted) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/training-plans/${plan.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen.");
      if (editingId === plan.id) resetForm();
      notify("Entwurf gelöscht", { message: `„${plan.title}“ wurde entfernt.`, tone: "success" });
      await loadData();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
      setMessage(text);
      notify("Löschen fehlgeschlagen", { message: text, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.root} vdc-plans-page`}>
      <header className="vdc-page-heading">
        <div><span className="vdc-kicker">Trainerbereich</span><h1>Trainingspläne</h1><p>Pläne erstellen, Übungen anordnen und Entwürfe sicher bearbeiten.</p></div>
        <Link className="button secondary" href="/trainer/archiv">Archiv & Statistiken</Link>
      </header>

      <section className="vdc-plan-workspace">
        <form className="vdc-plan-builder" onSubmit={save}>
          <header className="vdc-builder-header">
            <div><span className="vdc-kicker">{isAiDraft ? "AI-Coach-Entwurf" : editingId ? "Entwurf bearbeiten" : "Neuer Trainingsplan"}</span><h2>{editingId ? "Plan aktualisieren" : "Plan zusammenstellen"}</h2></div>
            {editingId && <button type="button" className="button secondary" onClick={resetForm}>Bearbeitung abbrechen</button>}
          </header>

          {isAiDraft && <div className="vdc-ai-plan-notice"><strong>Vom AI Coach vorgeschlagen</strong><span>Reihenfolge, Übungen und Zeitaufteilung bleiben vollständig bearbeitbar.</span></div>}

          <section className="vdc-builder-step">
            <div className="vdc-step-number">01</div>
            <div className="vdc-step-content">
              <header><div><small>Trainingsziel</small><h3>Was soll trainiert werden?</h3></div></header>
              <div className="vdc-goal-grid">
                {goals.map((item) => <button type="button" key={item.name} className={goal === item.name ? "is-selected" : ""} onClick={() => setGoal(item.name)}><span>{item.icon}</span><strong>{item.name}</strong><small>{item.text}</small></button>)}
              </div>
            </div>
          </section>

          <section className="vdc-builder-step">
            <div className="vdc-step-number">02</div>
            <div className="vdc-step-content">
              <header><div><small>Trainingsdaten</small><h3>Titel und Dauer festlegen</h3></div></header>
              <label>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Checkout unter Druck" required /></label>
              <div className="vdc-duration-picker" role="group" aria-label="Trainingsdauer">
                {durations.map((value) => <button type="button" key={value} className={duration === value ? "is-selected" : ""} onClick={() => setDuration(value)}><strong>{value}</strong><span>Min.</span></button>)}
              </div>
            </div>
          </section>

          <section className="vdc-builder-step">
            <div className="vdc-step-number">03</div>
            <div className="vdc-step-content">
              <header><div><small>Übungen</small><h3>Ablauf zusammenstellen</h3></div><button className="button secondary" type="button" onClick={generatePlan}>Automatisch erstellen</button></header>
              <label>Übung manuell hinzufügen<select defaultValue="" onChange={(event) => { if (event.target.value) addExercise(Number(event.target.value)); event.target.value = ""; }}><option value="">Übung auswählen …</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>

              {items.length === 0 ? <div className="vdc-empty-state"><strong>Noch keine Übungen im Plan</strong><p>Erstelle einen automatischen Vorschlag oder füge Übungen manuell hinzu.</p></div> : (
                <div className="vdc-exercise-timeline">
                  {items.map((item, index) => {
                    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
                    if (!exercise) return null;
                    const category = exercise.categories[0]?.category.name ?? goal;
                    return <article draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(index)} key={`${item.exerciseId}-${index}`}>
                      <div className="vdc-timeline-index"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                      <div className="vdc-timeline-card">
                        <div className="vdc-drag-handle" title="Verschieben">⋮⋮</div>
                        <div className="vdc-exercise-copy"><small>{category}</small><strong>{exercise.name}</strong><p>{exercise.description}</p></div>
                        <label className="vdc-duration-input"><span>Dauer</span><input aria-label={`Dauer für ${exercise.name}`} type="number" min="1" value={item.durationMin} onChange={(event) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, durationMin: Number(event.target.value) } : entry))} /><b>Min.</b></label>
                        <div className="vdc-timeline-actions">
                          <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`${exercise.name} nach oben verschieben`}>↑</button>
                          <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`${exercise.name} nach unten verschieben`}>↓</button>
                          <button type="button" className="is-danger" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Entfernen</button>
                        </div>
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="vdc-builder-step is-final">
            <div className="vdc-step-number">04</div>
            <div className="vdc-step-content">
              <header><div><small>Speichern</small><h3>Entwurf kontrollieren</h3></div></header>
              <div className={`vdc-duration-check ${durationDifference === 0 ? "is-valid" : ""}`}><div><small>Geplante Gesamtdauer</small><strong>{total} / {duration} Minuten</strong></div><span>{durationDifference === 0 ? "Dauer passt" : durationDifference > 0 ? `${durationDifference} Minuten fehlen` : `${Math.abs(durationDifference)} Minuten zu lang`}</span></div>
              <div className="vdc-builder-actions"><button className="button" disabled={saving || items.length === 0}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Als Entwurf speichern"}</button>{editingId && <button type="button" className="button secondary" onClick={resetForm}>Abbrechen</button>}</div>
              {message && <p className="form-message" role="status">{message}</p>}
            </div>
          </section>
        </form>

        <aside className="vdc-plan-summary">
          <span className="vdc-kicker">Zusammenfassung</span><h2>{title || "Neuer Trainingsplan"}</h2>
          <dl><div><dt>Ziel</dt><dd>{goal}</dd></div><div><dt>Dauer</dt><dd>{duration} Min.</dd></div><div><dt>Übungen</dt><dd>{items.length}</dd></div><div><dt>Geplant</dt><dd>{total} Min.</dd></div></dl>
          <div className="vdc-summary-progress"><div><span style={{ width: `${Math.min(100, Math.round((total / Math.max(duration, 1)) * 100))}%` }} /></div><small>{durationDifference === 0 ? "Plan vollständig" : "Dauer noch anpassen"}</small></div>
          <p>Der Plan wird zunächst als Entwurf gespeichert und kann bis zur Veröffentlichung bearbeitet oder gelöscht werden.</p>
        </aside>
      </section>

      <section className="vdc-plan-library">
        <header className="vdc-section-heading"><div><span className="vdc-kicker">Gespeichert</span><h2>Trainingsplan-Bibliothek</h2></div><span>{draftPlans.length} Entwürfe · {publishedPlans.length} veröffentlicht</span></header>
        <div className="vdc-plan-group"><header><h3>Entwürfe</h3><span>{draftPlans.length}</span></header><div className="vdc-plan-card-grid">
          {draftPlans.length === 0 ? <div className="vdc-empty-state"><strong>Keine Entwürfe</strong><p>Neue Pläne erscheinen nach dem Speichern hier.</p></div> : draftPlans.map((plan) => <article className="vdc-plan-card" key={plan.id}><header><span className="vdc-status-badge is-draft"><i />Entwurf</span><small>{plan.title.startsWith("AI Coach ·") ? "AI Coach · " : ""}{plan.exercises.length} Übungen</small></header><h3>{plan.title}</h3><p>{plan.goal} · {plan.durationMin} Minuten</p><ol>{plan.exercises.slice(0, 4).map((item) => <li key={item.id}><span>{item.exercise.name}</span><b>{item.durationMin} Min.</b></li>)}</ol><div className="vdc-plan-card-actions"><button className="button secondary" onClick={() => editPlan(plan)}>Bearbeiten</button><button className="button danger-outline" disabled={saving} onClick={() => void deletePlan(plan)}>Löschen</button></div></article>)}
        </div></div>
        <div className="vdc-plan-group"><header><h3>Veröffentlicht</h3><span>{publishedPlans.length}</span></header><div className="vdc-plan-card-grid">
          {publishedPlans.length === 0 ? <div className="vdc-empty-state"><strong>Keine veröffentlichten Pläne</strong><p>Veröffentlichte Pläne werden schreibgeschützt angezeigt.</p></div> : publishedPlans.map((plan) => <article className="vdc-plan-card is-published" key={plan.id}><header><span className="vdc-status-badge is-published"><i />Veröffentlicht</span><small>{plan.exercises.length} Übungen</small></header><h3>{plan.title}</h3><p>{plan.goal} · {plan.durationMin} Minuten</p><ol>{plan.exercises.slice(0, 4).map((item) => <li key={item.id}><span>{item.exercise.name}</span><b>{item.durationMin} Min.</b></li>)}</ol><div className="vdc-plan-card-actions"><Link className="button secondary" href="/trainer/trainingstag">Für Trainingstag verwenden</Link></div></article>)}
        </div></div>
      </section>
    </main>
  );
}
