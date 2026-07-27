"use client";

import { useEffect, useMemo, useState } from "react";
import { useHomeInsights } from "./HomeInsightsProvider";

type CalendarEvent = {
  id: string;
  sourceId: number;
  type: "CLUB" | "HOME" | "PLANNED";
  date: string;
  title: string;
  goal: string;
  durationMin: number | null;
  status: string;
  note?: string | null;
  planId?: number | null;
  editable: boolean;
};

type CalendarData = {
  month: string;
  events: CalendarEvent[];
  plans: { id: number; title: string; goal: string; durationMin: number }[];
  summary: { completed: number; planned: number; club: number; home: number };
  heatmap: { date: string; count: number }[];
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function buildDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const total = Math.ceil((offset + last.getDate()) / 7) * 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function HomeTrainingCalendar() {
  const { playerId } = useHomeInsights();
  const [month, setMonth] = useState(() => new Date());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [showPlanner, setShowPlanner] = useState(false);
  const [planId, setPlanId] = useState("");
  const [time, setTime] = useState("18:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!playerId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/home-training/calendar?playerId=${playerId}&month=${monthKey(month)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Kalender konnte nicht geladen werden.");
      setData(payload as CalendarData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kalender konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [playerId, month]);

  const days = useMemo(() => buildDays(month), [month]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data?.events ?? []) {
      const key = dateKey(new Date(event.date));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [data]);
  const heatmap = useMemo(() => new Map((data?.heatmap ?? []).map((item) => [item.date, item.count])), [data]);
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  function shiftMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  async function createSchedule() {
    if (!playerId) return;
    setSaving(true);
    setError("");
    try {
      const scheduledFor = new Date(`${selectedDate}T${time}:00`);
      const response = await fetch("/api/home-training/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, planId: planId || null, scheduledFor: scheduledFor.toISOString(), note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Termin konnte nicht gespeichert werden.");
      setShowPlanner(false);
      setNote("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Termin konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSchedule(event: CalendarEvent, completed: boolean) {
    if (!playerId) return;
    await fetch("/api/home-training/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.sourceId, playerId, completed }),
    });
    await load();
  }

  async function deleteSchedule(event: CalendarEvent) {
    if (!playerId || !window.confirm("Geplanten Termin wirklich löschen?")) return;
    await fetch("/api/home-training/calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.sourceId, playerId }),
    });
    await load();
  }

  if (!playerId) return null;

  return (
    <section className="home-calendar" aria-label="Persönlicher Trainingskalender">
      <header className="home-calendar-head">
        <div><span>Trainingskalender</span><h2>Plane deinen Rhythmus</h2><p>Vereinstraining, Heimtraining und persönliche Termine in einer Ansicht.</p></div>
        <button type="button" onClick={() => setShowPlanner(true)}>+ Einheit planen</button>
      </header>

      {data && (
        <div className="home-calendar-kpis">
          <article><span>Abgeschlossen</span><strong>{data.summary.completed}</strong></article>
          <article><span>Geplant</span><strong>{data.summary.planned}</strong></article>
          <article><span>Verein</span><strong>{data.summary.club}</strong></article>
          <article><span>Zuhause</span><strong>{data.summary.home}</strong></article>
        </div>
      )}

      <div className="home-calendar-toolbar">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">›</button>
        <button type="button" onClick={() => setMonth(new Date())}>Heute</button>
      </div>

      {loading ? <div className="home-calendar-state">Kalender wird geladen …</div> : error && !data ? <div className="home-calendar-state is-error">{error}</div> : data ? (
        <div className="home-calendar-layout">
          <div className="home-calendar-grid">
            {WEEKDAYS.map((day) => <div className="home-calendar-weekday" key={day}>{day}</div>)}
            {days.map((day) => {
              const key = dateKey(day);
              const events = eventsByDay.get(key) ?? [];
              const active = key === selectedDate;
              const outside = day.getMonth() !== month.getMonth();
              const intensity = Math.min(3, heatmap.get(key) ?? 0);
              return (
                <button type="button" key={key} className={`${active ? "is-selected" : ""} ${outside ? "is-outside" : ""} heat-${intensity}`} onClick={() => setSelectedDate(key)}>
                  <span>{day.getDate()}</span>
                  <div>{events.slice(0, 3).map((event) => <i key={event.id} className={`type-${event.type.toLowerCase()}`} title={event.title} />)}</div>
                  {events.length > 3 && <small>+{events.length - 3}</small>}
                </button>
              );
            })}
          </div>

          <aside className="home-calendar-day">
            <div><span>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}</span><h3>{selectedEvents.length ? `${selectedEvents.length} Einträge` : "Noch nichts geplant"}</h3></div>
            <div className="home-calendar-events">
              {selectedEvents.map((event) => (
                <article key={event.id} className={`type-${event.type.toLowerCase()}`}>
                  <div><span>{event.type === "CLUB" ? "Verein" : event.type === "HOME" ? "Heimtraining" : "Geplant"}</span><strong>{event.title}</strong><small>{event.goal}{event.durationMin ? ` · ${event.durationMin} Min.` : ""}</small>{event.note && <p>{event.note}</p>}</div>
                  {event.editable && <div className="home-calendar-event-actions"><button onClick={() => void updateSchedule(event, event.status !== "COMPLETED")}>{event.status === "COMPLETED" ? "Wieder öffnen" : "Erledigt"}</button><button onClick={() => void deleteSchedule(event)}>Löschen</button></div>}
                </article>
              ))}
              {!selectedEvents.length && <p>Plane eine Heimtrainingseinheit oder nutze diesen Tag als Regeneration.</p>}
            </div>
            <button type="button" className="home-calendar-plan-day" onClick={() => setShowPlanner(true)}>Für diesen Tag planen</button>
          </aside>
        </div>
      ) : null}

      {error && data && <div className="home-calendar-state is-error">{error}</div>}

      {showPlanner && (
        <div className="home-calendar-modal" role="dialog" aria-modal="true" aria-label="Training planen" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanner(false); }}>
          <div>
            <header><div><span>Neue Planung</span><h3>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</h3></div><button onClick={() => setShowPlanner(false)}>×</button></header>
            <label>Trainingsplan<select value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Freies Training</option>{data?.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} · {plan.durationMin} Min.</option>)}</select></label>
            <label>Uhrzeit<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            <label>Notiz<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optionaler Fokus oder Hinweis" /></label>
            <div className="home-calendar-modal-actions"><button onClick={() => setShowPlanner(false)}>Abbrechen</button><button disabled={saving} onClick={() => void createSchedule()}>{saving ? "Wird gespeichert …" : "Termin speichern"}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
