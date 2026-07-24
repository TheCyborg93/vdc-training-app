"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Exercise = {
  id: number;
  name: string;
  shortDescription: string | null;
  description: string;
  instructions: string | null;
  materials: string | null;
  trainerNotes: string | null;
  defaultMinutes: number;
  minPlayers: number;
  maxPlayers: number | null;
  difficulty: number;
  intensity: number;
  funFactor: number;
  learningCurve: number;
  resultType: string;
  engine: string;
  completionMode: string;
  completionValue: number | null;
  tagsJson: unknown;
  variantsJson: unknown;
  favorite: boolean;
  active: boolean;
  categories: { category: { name: string } }[];
};

const fallbackCategories = ["Aufwärmen", "Scoring", "Doppel", "Checkout", "Stellen", "Segmenttraining", "Mental", "Konzentration", "Wurftechnik", "Matchtraining", "Gruppentraining", "Heimtraining", "Fun", "Turniervorbereitung"];
const resultTypes = [
  ["HITS_0_TO_3", "Treffer 0–3"], ["SCORE_0_TO_180", "Punkte 0–180"], ["CHECKOUT", "Checkout"],
  ["LEGS", "Legs"], ["TIME_BASED", "Zeitbasiert"], ["BOOLEAN", "Erfolg / Misserfolg"], ["CUSTOM", "Individuell"]
];
const engines = [
  ["AUTO", "Automatisch erkennen"], ["BOB27", "Bob’s 27"], ["AROUND_CLOCK", "Around the Clock"],
  ["AROUND_DOUBLES", "Around the Clock – Doppel"], ["AROUND_TREBLES", "Around the Clock – Triple"],
  ["X01", "301 / 501 / X01"], ["CHECKOUT_LADDER", "Checkout-Leiter"], ["SCORING", "Scoring"],
  ["SHANGHAI", "Shanghai"], ["JDC_CHALLENGE", "JDC Challenge"], ["DOUBLES_ROUNDS", "Doppelrunden"],
  ["BULL_ROUNDS", "Bulltraining"], ["HIT_ROUNDS", "Trefferübung"], ["TIME_BASED", "Zeittraining"], ["CUSTOM", "Eigene Übung"]
];
const completionModes = [
  ["ENGINE_DEFAULT", "Nach den Regeln der Übung"], ["TARGET_REACHED", "Wenn das Ziel erreicht ist"],
  ["VISIT_LIMIT", "Nach einer Anzahl Aufnahmen"], ["DART_LIMIT", "Nach einer Anzahl Darts"],
  ["TIME_LIMIT", "Nach einer Zeit in Minuten"], ["MANUAL", "Manuell beenden"]
];

const emptyForm = {
  name: "", shortDescription: "", description: "", instructions: "", materials: "Dartboard, drei Darts und Ergebniserfassung", trainerNotes: "",
  defaultMinutes: "15", minPlayers: "1", maxPlayers: "", difficulty: "5", intensity: "5", funFactor: "5", learningCurve: "5",
  resultType: "CUSTOM", engine: "AUTO", completionMode: "ENGINE_DEFAULT", completionValue: "", categories: [] as string[], tags: "", variants: ""
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function optionLabel(options: string[][], value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

export default function ExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [availableCategories, setAvailableCategories] = useState(fallbackCategories);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALLE");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/exercises", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler beim Laden.");
      setItems(data.exercises ?? []);
      const names = Array.isArray(data.categories) ? data.categories.map((entry: { name: string }) => entry.name) : [];
      setAvailableCategories([...new Set([...fallbackCategories, ...names])].sort());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Übungen konnten nicht geladen werden.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const categories = item.categories.map((entry) => entry.category.name);
      const tags = stringList(item.tagsJson);
      const matchesSearch = !term || [item.name, item.shortDescription, item.description, item.engine, ...categories, ...tags].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      return matchesSearch && (categoryFilter === "ALLE" || categories.includes(categoryFilter)) && (!favoritesOnly || item.favorite) && (!activeOnly || item.active);
    });
  }, [items, search, categoryFilter, favoritesOnly, activeOnly]);

  const completionNeedsValue = ["VISIT_LIMIT", "DART_LIMIT", "TIME_LIMIT"].includes(form.completionMode);
  const completionUnit = form.completionMode === "VISIT_LIMIT" ? "Aufnahmen" : form.completionMode === "DART_LIMIT" ? "Darts" : "Minuten";

  function toggleCategory(name: string) {
    setForm((current) => ({ ...current, categories: current.categories.includes(name) ? current.categories.filter((item) => item !== name) : [...current.categories, name] }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
        variants: form.variants.split("\n").map((item) => item.trim()).filter(Boolean)
      };
      const response = await fetch(editingId ? `/api/exercises/${editingId}` : "/api/exercises", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      setMessage(editingId ? "Übung und Regelwerk aktualisiert." : "Übung mit Regelwerk hinzugefügt.");
      setForm(emptyForm); setEditingId(null); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally { setSaving(false); }
  }

  function edit(item: Exercise) {
    setEditingId(item.id);
    setForm({
      name: item.name, shortDescription: item.shortDescription ?? "", description: item.description, instructions: item.instructions ?? "",
      materials: item.materials ?? "", trainerNotes: item.trainerNotes ?? "", defaultMinutes: String(item.defaultMinutes), minPlayers: String(item.minPlayers),
      maxPlayers: item.maxPlayers == null ? "" : String(item.maxPlayers), difficulty: String(item.difficulty), intensity: String(item.intensity),
      funFactor: String(item.funFactor), learningCurve: String(item.learningCurve), resultType: item.resultType, engine: item.engine ?? "AUTO",
      completionMode: item.completionMode ?? "ENGINE_DEFAULT", completionValue: item.completionValue == null ? "" : String(item.completionValue),
      categories: item.categories.map((entry) => entry.category.name), tags: stringList(item.tagsJson).join(", "), variants: stringList(item.variantsJson).join("\n")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function patch(item: Exercise, data: Record<string, unknown>) {
    const response = await fetch(`/api/exercises/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) setMessage("Änderung konnte nicht gespeichert werden.");
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
      <section className="dashboard-heading"><div><div className="eyebrow">Trainerbereich</div><h1>Übungskatalog 2.0</h1><p>Jede Übung erhält eine feste Regel-Engine und eine eindeutige Abschlussbedingung.</p></div></section>

      <section className="exercise-toolbar card">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Übung, Engine, Ziel oder Tag suchen …" />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALLE">Alle Kategorien</option>{availableCategories.map((name) => <option key={name}>{name}</option>)}</select>
        <label className="check-chip"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />Nur Favoriten</label>
        <label className="check-chip"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />Nur aktive</label>
      </section>

      <section className="player-admin-layout">
        <form className="admin-form card" onSubmit={submit}>
          <div className="section-heading"><div><span className="eyebrow">{editingId ? "Bearbeiten" : "Neu"}</span><h2>{editingId ? "Übung ändern" : "Eigene Übung"}</h2></div></div>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Kurzbeschreibung<input value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} /></label>
          <label>Beschreibung<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
          <label>Durchführung<textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
          <label>Material<input value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /></label>
          <label>Trainerhinweise<textarea value={form.trainerNotes} onChange={(event) => setForm({ ...form, trainerNotes: event.target.value })} /></label>
          <div className="form-grid-2">
            <label>Dauer<input type="number" min="1" value={form.defaultMinutes} onChange={(event) => setForm({ ...form, defaultMinutes: event.target.value })} /></label>
            <label>Schwierigkeit 1–10<input type="number" min="1" max="10" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} /></label>
            <label>Intensität 1–10<input type="number" min="1" max="10" value={form.intensity} onChange={(event) => setForm({ ...form, intensity: event.target.value })} /></label>
            <label>Spaßfaktor 1–10<input type="number" min="1" max="10" value={form.funFactor} onChange={(event) => setForm({ ...form, funFactor: event.target.value })} /></label>
            <label>Lernkurve 1–10<input type="number" min="1" max="10" value={form.learningCurve} onChange={(event) => setForm({ ...form, learningCurve: event.target.value })} /></label>
            <label>Min. Spieler<input type="number" min="1" value={form.minPlayers} onChange={(event) => setForm({ ...form, minPlayers: event.target.value })} /></label>
            <label>Max. Spieler<input type="number" min="1" value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: event.target.value })} placeholder="offen" /></label>
          </div>

          <section className="card" style={{ padding: 18 }}>
            <div className="eyebrow">Ergebnis- und Regelwerk</div>
            <label>Übungs-Engine<select value={form.engine} onChange={(event) => setForm({ ...form, engine: event.target.value })}>{engines.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Ergebnisart<select value={form.resultType} onChange={(event) => setForm({ ...form, resultType: event.target.value })}>{resultTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Abschlussbedingung<select value={form.completionMode} onChange={(event) => setForm({ ...form, completionMode: event.target.value, completionValue: ["VISIT_LIMIT", "DART_LIMIT", "TIME_LIMIT"].includes(event.target.value) ? form.completionValue : "" })}>{completionModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {completionNeedsValue && <label>Anzahl {completionUnit}<input type="number" min="1" value={form.completionValue} onChange={(event) => setForm({ ...form, completionValue: event.target.value })} required /></label>}
            <p className="visit-help">Bei „Nach den Regeln der Übung“ steuert die ausgewählte Engine das Ende, z. B. Bob’s 27 nach DBull oder bei 0 Punkten.</p>
          </section>

          <label>Tags, mit Komma getrennt<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Doppel, Druck, Anfänger" /></label>
          <label>Varianten, eine pro Zeile<textarea value={form.variants} onChange={(event) => setForm({ ...form, variants: event.target.value })} /></label>
          <fieldset className="category-fieldset"><legend>Kategorien</legend><div className="category-grid">{availableCategories.map((name) => <label className="check-chip" key={name}><input type="checkbox" checked={form.categories.includes(name)} onChange={() => toggleCategory(name)} />{name}</label>)}</div></fieldset>
          <div className="actions"><button className="button" disabled={saving}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Übung hinzufügen"}</button>{editingId && <button className="button secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Abbrechen</button>}</div>
          {message && <p className="form-message">{message}</p>}
        </form>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Bibliothek</span><h2>{filteredItems.length} von {items.length} Übungen</h2></div></div>
          {loading ? <div className="card"><p>Übungen werden geladen …</p></div> : <div className="exercise-catalog-grid">
            {filteredItems.map((item) => <article className={`exercise-catalog-card ${item.active ? "" : "is-inactive"}`} key={item.id}>
              <div className="exercise-card-top"><span className="exercise-icon">{item.defaultMinutes}</span><button className={`favorite-button ${item.favorite ? "is-favorite" : ""}`} onClick={() => void patch(item, { favorite: !item.favorite })} aria-label="Favorit">★</button></div>
              <div className="player-title-row"><strong>{item.name}</strong><span className={item.active ? "status" : "status status-muted"}>{item.active ? "Aktiv" : "Inaktiv"}</span></div>
              <p>{item.shortDescription || item.description}</p>
              <div className="exercise-ratings"><span>Schwere {item.difficulty}/10</span><span>Intensität {item.intensity}/10</span><span>Spaß {item.funFactor}/10</span><span>Lernen {item.learningCurve}/10</span></div>
              <div className="category-tags"><span>{optionLabel(engines, item.engine ?? "AUTO")}</span><span>{optionLabel(completionModes, item.completionMode ?? "ENGINE_DEFAULT")}{item.completionValue ? `: ${item.completionValue}` : ""}</span>{item.categories.map((entry) => <span key={entry.category.name}>{entry.category.name}</span>)}</div>
              <div className="exercise-meta">{stringList(item.tagsJson).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div>
              <div className="player-actions"><button onClick={() => edit(item)}>Bearbeiten</button><button onClick={() => void patch(item, { active: !item.active })}>{item.active ? "Deaktivieren" : "Aktivieren"}</button><button className="danger-link" onClick={() => void remove(item)}>Entfernen</button></div>
            </article>)}
          </div>}
        </section>
      </section>
    </main>
  );
}