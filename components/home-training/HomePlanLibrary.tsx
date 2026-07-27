"use client";

import { useEffect, useMemo, useState } from "react";
import { useHomeInsights } from "@/components/home-training/HomeInsightsProvider";

type LibraryPlan = {
  id: number;
  playerId: number;
  title: string;
  goal: string;
  durationMin: number;
  exerciseCount: number;
  favorite: boolean;
  archived: boolean;
  folder: string | null;
  source: string;
  version: number;
  usageCount: number;
  resultCount: number;
  lastUsedAt: string | null;
  averageScore: number | null;
  rating: number;
  recommendation: string;
};

type LibraryData = {
  plans: LibraryPlan[];
  summary: { total: number; favorites: number; archived: number; trainings: number; bestCategory: string };
};

type Tab = "favorites" | "own" | "ai" | "archive";
type Sort = "updated" | "usage" | "rating" | "duration" | "title";

function relativeDate(value: string | null) {
  if (!value) return "Noch nicht verwendet";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Heute verwendet";
  if (days === 1) return "Gestern verwendet";
  return `vor ${days} Tagen verwendet`;
}

function stars(value: number) {
  const rounded = Math.round(value);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

export default function HomePlanLibrary() {
  const { playerId, data: insights } = useHomeInsights();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("own");
  const [search, setSearch] = useState("");
  const [goal, setGoal] = useState("Alle");
  const [duration, setDuration] = useState("Alle");
  const [sort, setSort] = useState<Sort>("updated");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<LibraryPlan | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFolder, setEditFolder] = useState("");

  async function load() {
    if (!playerId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/home-training/library?playerId=${playerId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Bibliothek konnte nicht geladen werden.");
      setData(payload as LibraryData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bibliothek konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [playerId]);

  const goals = useMemo(() => ["Alle", ...Array.from(new Set(data?.plans.map((plan) => plan.goal) ?? []))], [data]);
  const activeSession = insights?.quickstart.activeSession ?? null;

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    const plans = (data?.plans ?? []).filter((plan) => {
      if (tab === "favorites" && (!plan.favorite || plan.archived)) return false;
      if (tab === "own" && (plan.archived || plan.source === "AI")) return false;
      if (tab === "ai" && (plan.archived || plan.source !== "AI")) return false;
      if (tab === "archive" && !plan.archived) return false;
      if (goal !== "Alle" && plan.goal !== goal) return false;
      if (duration === "short" && plan.durationMin > 30) return false;
      if (duration === "medium" && (plan.durationMin < 31 || plan.durationMin > 60)) return false;
      if (duration === "long" && plan.durationMin < 61) return false;
      if (term && !`${plan.title} ${plan.goal} ${plan.folder ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });

    return [...plans].sort((a, b) => {
      if (sort === "usage") return b.usageCount - a.usageCount;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "duration") return a.durationMin - b.durationMin;
      if (sort === "title") return a.title.localeCompare(b.title, "de");
      return new Date(b.lastUsedAt ?? 0).getTime() - new Date(a.lastUsedAt ?? 0).getTime();
    });
  }, [data, tab, goal, duration, search, sort]);

  async function patch(plan: LibraryPlan, changes: Record<string, unknown>) {
    if (!playerId) return;
    setBusyId(plan.id);
    setError("");
    try {
      const response = await fetch("/api/home-training/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, planId: plan.id, ...changes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Plan konnte nicht aktualisiert werden.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Plan konnte nicht aktualisiert werden.");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(plan: LibraryPlan) {
    if (!playerId) return;
    setBusyId(plan.id);
    setError("");
    try {
      const response = await fetch("/api/home-training/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", playerId, planId: plan.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Plan konnte nicht dupliziert werden.");
      setTab("own");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Plan konnte nicht dupliziert werden.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(plan: LibraryPlan) {
    if (!playerId || !window.confirm(`„${plan.title}“ wirklich entfernen? Bereits verwendete Pläne werden sicher archiviert.`)) return;
    setBusyId(plan.id);
    try {
      const response = await fetch("/api/home-training/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, planId: plan.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Plan konnte nicht entfernt werden.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Plan konnte nicht entfernt werden.");
    } finally {
      setBusyId(null);
    }
  }

  async function start(plan: LibraryPlan) {
    if (!playerId || activeSession) return;
    setBusyId(plan.id);
    setError("");
    try {
      const response = await fetch("/api/home-training/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", planId: plan.id, playerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Training konnte nicht gestartet werden.");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Training konnte nicht gestartet werden.");
      setBusyId(null);
    }
  }

  function openEditor(plan: LibraryPlan) {
    setEditing(plan);
    setEditTitle(plan.title);
    setEditFolder(plan.folder ?? "");
  }

  async function saveEditor() {
    if (!editing || !editTitle.trim()) return;
    await patch(editing, { title: editTitle.trim(), folder: editFolder.trim() || null });
    setEditing(null);
  }

  if (!playerId) return null;

  return (
    <section className="home-library-shell" aria-label="Persönliche Trainingsbibliothek">
      <header className="home-library-heading">
        <div><span>Planbibliothek</span><h2>Deine Trainingseinheiten</h2><p>Favorisieren, organisieren, kopieren und direkt starten.</p></div>
        {data && <strong>{data.summary.total} aktive Pläne</strong>}
      </header>

      {data && (
        <div className="home-library-kpis">
          <article><span>Pläne</span><strong>{data.summary.total}</strong><small>aktiv verfügbar</small></article>
          <article><span>Favoriten</span><strong>{data.summary.favorites}</strong><small>schnell erreichbar</small></article>
          <article><span>Trainings</span><strong>{data.summary.trainings}</strong><small>mit Bibliotheksplänen</small></article>
          <article><span>Stärkster Bereich</span><strong>{data.summary.bestCategory}</strong><small>häufigster Fokus</small></article>
        </div>
      )}

      <nav className="home-library-tabs" aria-label="Bibliotheksbereiche">
        <button className={tab === "favorites" ? "is-active" : ""} onClick={() => setTab("favorites")}>★ Favoriten</button>
        <button className={tab === "own" ? "is-active" : ""} onClick={() => setTab("own")}>Meine Pläne</button>
        <button className={tab === "ai" ? "is-active" : ""} onClick={() => setTab("ai")}>KI-Pläne</button>
        <button className={tab === "archive" ? "is-active" : ""} onClick={() => setTab("archive")}>Archiv {data?.summary.archived ? `(${data.summary.archived})` : ""}</button>
      </nav>

      <div className="home-library-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Plan, Ziel oder Ordner suchen …" aria-label="Bibliothek durchsuchen" />
        <select value={goal} onChange={(event) => setGoal(event.target.value)} aria-label="Trainingsziel filtern">{goals.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={duration} onChange={(event) => setDuration(event.target.value)} aria-label="Dauer filtern">
          <option value="Alle">Alle Dauern</option><option value="short">Bis 30 Min.</option><option value="medium">31–60 Min.</option><option value="long">Ab 61 Min.</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Pläne sortieren">
          <option value="updated">Zuletzt verwendet</option><option value="usage">Meist trainiert</option><option value="rating">Beste Bewertung</option><option value="duration">Kürzeste Dauer</option><option value="title">Name A–Z</option>
        </select>
      </div>

      {loading ? (
        <div className="home-library-state">Bibliothek wird geladen …</div>
      ) : error && !data ? (
        <div className="home-library-state is-error">{error}</div>
      ) : visiblePlans.length ? (
        <div className="home-library-grid">
          {visiblePlans.map((plan) => (
            <article className={`home-library-card ${plan.favorite ? "is-favorite" : ""} ${plan.archived ? "is-archived" : ""}`} key={plan.id}>
              <div className="home-library-card-top">
                <div><span>{plan.goal}</span>{plan.folder && <small>{plan.folder}</small>}</div>
                <button className={plan.favorite ? "is-active" : ""} disabled={busyId === plan.id} onClick={() => void patch(plan, { favorite: !plan.favorite })} aria-label={plan.favorite ? "Favorit entfernen" : "Favorisieren"}>★</button>
              </div>
              <h3>{plan.title}</h3>
              <p>{plan.recommendation}</p>
              <div className="home-library-rating"><span>{stars(plan.rating)}</span><strong>{plan.rating.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</strong><small>Version {plan.version}</small></div>
              <div className="home-library-meta">
                <div><strong>{plan.durationMin}</strong><span>Minuten</span></div>
                <div><strong>{plan.exerciseCount}</strong><span>Übungen</span></div>
                <div><strong>{plan.usageCount}</strong><span>Trainings</span></div>
                <div><strong>{plan.averageScore ?? "–"}</strong><span>Ø Wert</span></div>
              </div>
              <div className="home-library-used"><span>{relativeDate(plan.lastUsedAt)}</span><small>{plan.resultCount} Ergebnisse</small></div>
              <div className="home-library-actions">
                {!plan.archived && <button className="is-primary" disabled={busyId === plan.id || Boolean(activeSession)} onClick={() => void start(plan)}>{busyId === plan.id ? "Bitte warten …" : activeSession ? "Einheit aktiv" : "Starten"}</button>}
                <button disabled={busyId === plan.id} onClick={() => openEditor(plan)}>Bearbeiten</button>
                <button disabled={busyId === plan.id} onClick={() => void duplicate(plan)}>Duplizieren</button>
                <button disabled={busyId === plan.id} onClick={() => void patch(plan, { archived: !plan.archived })}>{plan.archived ? "Wiederherstellen" : "Archivieren"}</button>
                <button className="is-danger" disabled={busyId === plan.id} onClick={() => void remove(plan)}>Löschen</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="home-library-state"><strong>Keine passenden Pläne</strong><span>Filter ändern oder einen bestehenden Plan duplizieren.</span></div>
      )}

      {error && data && <p className="home-library-error">{error}</p>}

      {editing && (
        <div className="home-library-modal" role="dialog" aria-modal="true" aria-label="Trainingsplan bearbeiten" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <div>
            <span>Plan bearbeiten</span><h3>{editing.title}</h3>
            <label>Titel<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></label>
            <label>Ordner<input value={editFolder} onChange={(event) => setEditFolder(event.target.value)} placeholder="z. B. Liga, Warm-up, Checkout" /></label>
            <div><button onClick={() => setEditing(null)}>Abbrechen</button><button className="is-primary" disabled={!editTitle.trim() || busyId === editing.id} onClick={() => void saveEditor()}>Speichern</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
