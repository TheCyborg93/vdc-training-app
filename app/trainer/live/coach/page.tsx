"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";

type Player = { id: number; displayName: string };
type LiveBoard = {
  id: number;
  board: { id: number; name: string };
  status: "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED";
  startedAt: string | null;
  lastResultAt: string | null;
  players: Player[];
  currentPlayer: Player | null;
  currentExercise: { id: number; name: string } | null;
  progressPercent: number;
  resultCount: number;
};
type LiveTraining = {
  id: number;
  status: string;
  trainingDate: string;
  trainingPlan: { title: string; goal: string; durationMin: number };
  boards: LiveBoard[];
};
type Priority = "critical" | "warning" | "good" | "waiting" | "done";

const priorityOrder: Record<Priority, number> = { critical: 0, warning: 1, waiting: 2, good: 3, done: 4 };

function minutesSince(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
}

function boardPriority(board: LiveBoard): { level: Priority; label: string; detail: string } {
  if (board.status === "COMPLETED") return { level: "done", label: "Fertig", detail: "Training abgeschlossen" };
  if (board.status === "PAUSED") return { level: "warning", label: "Pausiert", detail: "Trainer prüfen" };
  if (board.status === "NOT_STARTED") return { level: "waiting", label: "Wartet", detail: "Noch nicht gestartet" };
  const idle = minutesSince(board.lastResultAt ?? board.startedAt) ?? 0;
  if (idle >= 8) return { level: "critical", label: "Eingreifen", detail: `${idle} Min. ohne Eingabe` };
  if (idle >= 4) return { level: "warning", label: "Beobachten", detail: `${idle} Min. ohne Eingabe` };
  return { level: "good", label: "Läuft", detail: board.lastResultAt ? `vor ${idle} Min. aktiv` : "gerade gestartet" };
}

export default function LiveCoachPage() {
  const { notify } = useAppFeedback();
  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const response = await fetch("/api/trainer/live", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Live-Daten konnten nicht geladen werden.");
      setTraining(payload);
      setLastUpdated(new Date());
    } catch (error) {
      if (!silent) notify("Coach-Ansicht nicht erreichbar", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && busy === null) void load(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [load, busy]);

  const rankedBoards = useMemo(() => (training?.boards ?? [])
    .map((board) => ({ board, priority: boardPriority(board) }))
    .sort((a, b) => priorityOrder[a.priority.level] - priorityOrder[b.priority.level] || a.board.progressPercent - b.board.progressPercent), [training, lastUpdated]);

  const summary = useMemo(() => {
    const boards = training?.boards ?? [];
    return {
      active: boards.filter((board) => board.status === "RUNNING").length,
      attention: boards.filter((board) => ["critical", "warning"].includes(boardPriority(board).level)).length,
      completed: boards.filter((board) => board.status === "COMPLETED").length,
      progress: boards.length ? Math.round(boards.reduce((sum, board) => sum + board.progressPercent, 0) / boards.length) : 0,
    };
  }, [training, lastUpdated]);

  async function runAction(board: LiveBoard, action: "pause" | "resume" | "finish_exercise") {
    setBusy(board.id);
    try {
      const response = await fetch("/api/trainer/live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSessionId: board.id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Aktion fehlgeschlagen.");
      notify(payload.message ?? "Board aktualisiert.", { message: board.board.name, tone: "success" });
      await load(true);
    } catch (error) {
      notify("Aktion fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <main className="phase6-coach-view"><div className="phase6-coach-loading"><i /><i /><i /></div></main>;
  if (!training) return <main className="phase6-coach-view"><section className="phase6-coach-empty"><h1>Kein Live-Training aktiv</h1><p>Starte oder veröffentliche zuerst einen Trainingstag.</p><Link href="/trainer">Zum Trainer-Dashboard</Link></section></main>;

  return (
    <main className="phase6-coach-view">
      <header className="phase6-coach-header">
        <div><span>COACH VIEW</span><h1>{training.trainingPlan.title}</h1><p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten</p></div>
        <div className="phase6-coach-header-actions"><div><i /><strong>Live</strong><small>{lastUpdated?.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></div><Link href="/trainer/live">Control Center</Link></div>
      </header>

      <section className="phase6-coach-kpis">
        <article><span>Gesamtfortschritt</span><strong>{summary.progress}%</strong><i><b style={{ width: `${summary.progress}%` }} /></i></article>
        <article><span>Aktive Boards</span><strong>{summary.active}</strong></article>
        <article className={summary.attention > 0 ? "is-alert" : ""}><span>Trainer prüfen</span><strong>{summary.attention}</strong></article>
        <article><span>Fertig</span><strong>{summary.completed}</strong></article>
      </section>

      <section className="phase6-coach-board-list">
        {rankedBoards.map(({ board, priority }, index) => (
          <article className={`phase6-coach-board is-${priority.level}`} key={board.id}>
            <div className="phase6-coach-rank"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
            <div className="phase6-coach-board-main">
              <header><div><small>{board.board.name}</small><h2>{board.currentExercise?.name ?? priority.label}</h2></div><span>{priority.label}</span></header>
              <div className="phase6-coach-player"><strong>{board.currentPlayer?.displayName ?? board.players[0]?.displayName ?? "Kein Spieler"}</strong><small>{board.players.map((player) => player.displayName).join(" · ") || "Board frei"}</small></div>
              <div className="phase6-coach-progress"><i><b style={{ width: `${board.progressPercent}%` }} /></i><strong>{board.progressPercent}%</strong></div>
              <footer><span>{priority.detail}</span><span>{board.resultCount} Ergebnisse</span></footer>
            </div>
            <div className="phase6-coach-actions">
              {board.status === "RUNNING" && <button disabled={busy === board.id} onClick={() => void runAction(board, "pause")}>Pause</button>}
              {board.status === "PAUSED" && <button disabled={busy === board.id} onClick={() => void runAction(board, "resume")}>Fortsetzen</button>}
              {(board.status === "RUNNING" || board.status === "PAUSED") && <button className="is-primary" disabled={busy === board.id} onClick={() => void runAction(board, "finish_exercise")}>Nächste Übung</button>}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
