"use client";

import { FormEvent, useEffect, useState } from "react";

type Exercise = {
  id: number;
  name: string;
  description: string;
  instructions: string | null;
  defaultMinutes: number;
  minPlayers: number;
  maxPlayers: number | null;
  difficulty: number;
  resultType: string;
  active: boolean;
  categories: { category: { name: string } }[];
};

const categories = ["Aufwärmen", "Scoring", "Doppel", "Checkout", "Stellen", "Mental", "Konzentration", "Wurftechnik", "Matchtraining"];
const resultTypes = [
  ["HITS_0_TO_3", "Treffer 0–3"],
  ["SCORE_0_TO_180", "Punkte 0–180"],
  ["CHECKOUT", "Checkout"],
  ["LEGS", "Legs"],
  ["TIME_BASED", "Zeitbasiert"],
  ["BOOLEAN", "Erfolg / Misserfolg"],
  ["CUSTOM", "Individuell"]
];

const emptyForm = {
  name: "",
  description: "",
  instructions: "",
  defaultMinutes: "15",
  minPlayers: "1",
  maxPlayers: "",
  difficulty: "1",
  resultType: "CUSTOM",
  categories: [] as string[]
};

export default function ExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/exercises", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler beim Laden.");
      setItems(data.exercises ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Übungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function toggleCategory(name: string) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(name)
        ? current.categories.filter((item) => item !== name)
        : [...current.categories, name]
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/exercises/${editingId}` : "/api/exercises", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      setMessage(editingId ? "Übung aktualisiert." : "Übung hinzugefügt.");
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function edit(item: Exercise) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      instructions: item.instructions ?? "",
      defaultMinutes: String(item.defaultMinutes),
      minPlayers: String(item.minPlayers),
      maxPlayers: item.maxPlayers == null ? "" : String(item.maxPlayers),
      difficulty: String(item.difficulty),
      resultType: item.resultType,
      categories: item.categories.map((entry) => entry.category.name)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(item: Exercise) {
    await fetch(`/api/exercises/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active })
    });
    await load();
  }

  async function remove(item: Exercise) {
    if (!window.confirm(`${item.name} wirklich entfernen?`)) return;
    const response = await fetch(`/api/exercises/${item.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(data.deactivated ? "Übung wird bereits verwendet und wurde deaktiviert." : "Übung entfernt.");
    await load();
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">Trainerbereich</div>
          <h1>Übungskatalog</h1>
          <p>Übungen, Kategorien und Ergebniseingaben zentral verwalten.</p>
        </div>
      </section>

      <section className="player-admin-layout">
        <form className="admin-form card" onSubmit={submit}>
          <div className="section-heading"><div><span className="eyebrow">{editingId ? "Bearbeiten" : "Neu"}</span><h2>{editingId ? "Übung ändern" : "Übung hinzufügen"}</h2></div></div>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Beschreibung<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
          <label>Anleitung<textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
          <div className="form-grid-2">
            <label>Dauer in Minuten<input type="number" min="1" value={form.defaultMinutes} onChange={(event) => setForm({ ...form, defaultMinutes: event.target.value })} required /></label>
            <label>Schwierigkeit<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="1">1 – leicht</option><option value="2">2</option><option value="3">3 – mittel</option><option value="4">4</option><option value="5">5 – schwer</option></select></label>
            <label>Min. Spieler<input type="number" min="1" value={form.minPlayers} onChange={(event) => setForm({ ...form, minPlayers: event.target.value })} /></label>
            <label>Max. Spieler<input type="number" min="1" value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: event.target.value })} placeholder="offen" /></label>
          </div>
          <label>Ergebnisart<select value={form.resultType} onChange={(event) => setForm({ ...form, resultType: event.target.value })}>{resultTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <fieldset className="category-fieldset"><legend>Kategorien</legend><div className="category-grid">{categories.map((name) => <label className="check-chip" key={name}><input type="checkbox" checked={form.categories.includes(name)} onChange={() => toggleCategory(name)} />{name}</label>)}</div></fieldset>
          <div className="actions">
            <button className="button" disabled={saving}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Übung hinzufügen"}</button>
            {editingId && <button className="button secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Abbrechen</button>}
          </div>
          {message && <p className="form-message">{message}</p>}
        </form>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Übersicht</span><h2>{items.length} Übungen</h2></div></div>
          {loading ? <div className="card"><p>Übungen werden geladen …</p></div> : items.length === 0 ? <div className="card"><p>Noch keine Übungen angelegt.</p></div> : <div className="player-list">
            {items.map((item) => <article className={`player-admin-card exercise-admin-card ${item.active ? "" : "is-inactive"}`} key={item.id}>
              <div className="exercise-icon">{item.defaultMinutes}</div>
              <div className="player-main">
                <div className="player-title-row"><strong>{item.name}</strong><span className={item.active ? "status" : "status status-muted"}>{item.active ? "Aktiv" : "Inaktiv"}</span></div>
                <p>{item.description}</p>
                <div className="exercise-meta"><span>{item.defaultMinutes} Min.</span><span>Stufe {item.difficulty}</span><span>{resultTypes.find(([value]) => value === item.resultType)?.[1] ?? item.resultType}</span></div>
                <div className="category-tags">{item.categories.map((entry) => <span key={entry.category.name}>{entry.category.name}</span>)}</div>
              </div>
              <div className="player-actions">
                <button onClick={() => edit(item)}>Bearbeiten</button>
                <button onClick={() => void toggleActive(item)}>{item.active ? "Deaktivieren" : "Aktivieren"}</button>
                <button className="danger-link" onClick={() => void remove(item)}>Entfernen</button>
              </div>
            </article>)}
          </div>}
        </section>
      </section>
    </main>
  );
}
