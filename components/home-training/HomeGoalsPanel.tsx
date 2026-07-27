"use client";

import { useEffect, useMemo, useState } from "react";
import { useHomeInsights } from "./HomeInsightsProvider";

type GoalMetric = "WEEKLY_SESSIONS" | "MONTHLY_RESULTS" | "CHECKOUT_RATE" | "BEST_SCORE" | "WEEK_STREAK";
type GoalStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";
type Goal = {
  id: number;
  title: string;
  metric: GoalMetric;
  targetValue: number;
  startAt: string;
  targetAt: string | null;
  status: GoalStatus;
  currentValue: number;
  progress: number;
  achieved: boolean;
  expired: boolean;
  unit: string;
};

type Draft = { title: string; metric: GoalMetric; targetValue: number; targetAt: string };

const METRICS: Record<GoalMetric, { label: string; unit: string; defaultTarget: number }> = {
  WEEKLY_SESSIONS: { label: "Trainingseinheiten pro Woche", unit: "Einheiten", defaultTarget: 2 },
  MONTHLY_RESULTS: { label: "Ergebnisse pro Monat", unit: "Ergebnisse", defaultTarget: 100 },
  CHECKOUT_RATE: { label: "Checkoutquote", unit: "%", defaultTarget: 20 },
  BEST_SCORE: { label: "Persönlicher Bestwert", unit: "Punkte", defaultTarget: 140 },
  WEEK_STREAK: { label: "Trainingsserie", unit: "Wochen", defaultTarget: 4 },
};

const PRESETS: { title: string; metric: GoalMetric; targetValue: number }[] = [
  { title: "2 Trainings pro Woche", metric: "WEEKLY_SESSIONS", targetValue: 2 },
  { title: "100 Ergebnisse im Monat", metric: "MONTHLY_RESULTS", targetValue: 100 },
  { title: "20 % Checkoutquote", metric: "CHECKOUT_RATE", targetValue: 20 },
  { title: "Bestwert 140 erreichen", metric: "BEST_SCORE", targetValue: 140 },
  { title: "4 Wochen im Rhythmus", metric: "WEEK_STREAK", targetValue: 4 },
];

const emptyDraft: Draft = { title: "", metric: "WEEKLY_SESSIONS", targetValue: 2, targetAt: "" };

function formatValue(value: number, metric: GoalMetric) {
  const digits = metric === "CHECKOUT_RATE" ? 1 : 0;
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "ohne Frist";
}

export default function HomeGoalsPanel() {
  const { playerId } = useHomeInsights();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/home-training/goals?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Ziele konnten nicht geladen werden.");
        setGoals(payload.goals ?? []);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Ziele konnten nicht geladen werden.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [playerId]);

  const visibleGoals = useMemo(() => goals.filter((goal) => showArchived || goal.status !== "ARCHIVED"), [goals, showArchived]);
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE").length;
  const achievedGoals = goals.filter((goal) => goal.achieved || goal.status === "COMPLETED").length;

  function choosePreset(preset: (typeof PRESETS)[number]) {
    setEditingId(null);
    setDraft({ ...preset, targetAt: "" });
    setShowCreator(true);
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setDraft({ title: goal.title, metric: goal.metric, targetValue: goal.targetValue, targetAt: goal.targetAt ? goal.targetAt.slice(0, 10) : "" });
    setShowCreator(true);
  }

  function closeEditor() {
    setShowCreator(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function saveGoal() {
    if (!playerId || !draft.title.trim() || draft.targetValue <= 0) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/home-training/goals", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId
          ? { id: editingId, title: draft.title, targetValue: draft.targetValue, targetAt: draft.targetAt || null }
          : { playerId, title: draft.title, metric: draft.metric, targetValue: draft.targetValue, targetAt: draft.targetAt || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ziel konnte nicht gespeichert werden.");
      setGoals(payload.goals ?? []);
      closeEditor();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ziel konnte nicht gespeichert werden.");
    } finally { setSaving(false); }
  }

  async function updateStatus(goal: Goal, status: GoalStatus) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/home-training/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ziel konnte nicht aktualisiert werden.");
      setGoals(payload.goals ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ziel konnte nicht aktualisiert werden.");
    } finally { setSaving(false); }
  }

  async function removeGoal(goal: Goal) {
    if (!window.confirm(`Ziel „${goal.title}“ wirklich löschen?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/home-training/goals?id=${goal.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ziel konnte nicht gelöscht werden.");
      setGoals(payload.goals ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ziel konnte nicht gelöscht werden.");
    } finally { setSaving(false); }
  }

  if (!playerId) return null;

  return (
    <section className="home-goals-shell" aria-label="Persönliche Trainingsziele">
      <header className="home-goals-heading">
        <div><span>Eigene Vorgaben</span><h2>Deine Trainingsziele</h2><p>Lege fest, was du erreichen möchtest. Der Fortschritt aktualisiert sich automatisch.</p></div>
        <div className="home-goals-summary"><strong>{achievedGoals}</strong><span>erreicht</span><i /><strong>{activeGoals}</strong><span>aktiv</span></div>
      </header>

      <div className="home-goals-presets">
        {PRESETS.map((preset) => <button key={preset.metric} onClick={() => choosePreset(preset)}><span>+</span><strong>{preset.title}</strong></button>)}
        <button className="is-custom" onClick={() => { setDraft(emptyDraft); setEditingId(null); setShowCreator(true); }}><span>+</span><strong>Eigenes Ziel</strong></button>
      </div>

      {showCreator && (
        <div className="home-goals-editor">
          <div><span>{editingId ? "Ziel bearbeiten" : "Neues Ziel"}</span><h3>{editingId ? "Vorgabe anpassen" : "Was möchtest du erreichen?"}</h3></div>
          <label>Titel<input value={draft.title} maxLength={100} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="z. B. Checkoutquote auf 25 % steigern" /></label>
          <label>Messwert<select disabled={Boolean(editingId)} value={draft.metric} onChange={(event) => { const metric = event.target.value as GoalMetric; setDraft((value) => ({ ...value, metric, targetValue: METRICS[metric].defaultTarget })); }}>{Object.entries(METRICS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
          <label>Zielwert<div className="home-goals-target-input"><input type="number" min="1" step={draft.metric === "CHECKOUT_RATE" ? "0.1" : "1"} value={draft.targetValue} onChange={(event) => setDraft((value) => ({ ...value, targetValue: Number(event.target.value) }))} /><span>{METRICS[draft.metric].unit}</span></div></label>
          <label>Zieldatum optional<input type="date" value={draft.targetAt} onChange={(event) => setDraft((value) => ({ ...value, targetAt: event.target.value }))} /></label>
          <div className="home-goals-editor-actions"><button className="secondary" onClick={closeEditor}>Abbrechen</button><button disabled={saving || !draft.title.trim() || draft.targetValue <= 0} onClick={() => void saveGoal()}>{saving ? "Wird gespeichert …" : editingId ? "Änderungen speichern" : "Ziel erstellen"}</button></div>
        </div>
      )}

      {loading ? (
        <div className="home-goals-state">Ziele werden geladen …</div>
      ) : error && goals.length === 0 ? (
        <div className="home-goals-state is-error">{error}</div>
      ) : visibleGoals.length ? (
        <div className="home-goals-grid">
          {visibleGoals.map((goal) => {
            const completed = goal.achieved || goal.status === "COMPLETED";
            return (
              <article className={`${completed ? "is-achieved" : ""} ${goal.expired ? "is-expired" : ""} ${goal.status === "ARCHIVED" ? "is-archived" : ""}`} key={goal.id}>
                <div className="home-goals-card-head"><span>{METRICS[goal.metric].label}</span><b>{completed ? "Erreicht" : goal.expired ? "Frist abgelaufen" : goal.status === "ARCHIVED" ? "Archiviert" : "Aktiv"}</b></div>
                <h3>{goal.title}</h3>
                <div className="home-goals-values"><strong>{formatValue(goal.currentValue, goal.metric)}</strong><span>von {formatValue(goal.targetValue, goal.metric)} · {goal.unit}</span></div>
                <div className="home-goals-progress"><i><b style={{ width: `${goal.progress}%` }} /></i><strong>{goal.progress} %</strong></div>
                <div className="home-goals-deadline"><span>Gestartet {formatDate(goal.startAt)}</span><span>Zieltermin {formatDate(goal.targetAt)}</span></div>
                <div className="home-goals-actions">
                  {goal.status === "ACTIVE" && <button onClick={() => startEdit(goal)}>Bearbeiten</button>}
                  {goal.status === "ACTIVE" && !completed && <button onClick={() => void updateStatus(goal, "COMPLETED")}>Als erreicht markieren</button>}
                  {goal.status !== "ARCHIVED" && <button onClick={() => void updateStatus(goal, "ARCHIVED")}>Archivieren</button>}
                  {goal.status === "ARCHIVED" && <button onClick={() => void updateStatus(goal, "ACTIVE")}>Reaktivieren</button>}
                  <button className="is-danger" onClick={() => void removeGoal(goal)}>Löschen</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="home-goals-empty"><span>Noch kein persönliches Ziel</span><strong>Wähle eine Vorlage oder erstelle deine eigene Vorgabe.</strong></div>
      )}

      {error && goals.length > 0 && <p className="home-goals-error">{error}</p>}
      {goals.some((goal) => goal.status === "ARCHIVED") && <button className="home-goals-archive-toggle" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Archivierte Ziele ausblenden" : "Archivierte Ziele anzeigen"}</button>}
    </section>
  );
}
