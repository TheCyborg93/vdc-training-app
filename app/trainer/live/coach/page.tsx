"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";
import { getBoardCoachHealth, sortBoardsByCoachPriority } from "@/lib/live-training/health";
import type { LiveBoardSnapshot, LiveTrainingSnapshot } from "@/lib/live-training/types";
import { useTrainingRealtime } from "@/lib/realtime/use-training-realtime";

export default function LiveCoachPage() {
  const { notify } = useAppFeedback();
  const [training, setTraining] = useState<LiveTrainingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());

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

  const handleRealtimeMessage = useCallback(async () => {
    if (document.visibilityState === "visible" && busy === null) await load(true);
  }, [busy, load]);

  const realtimeState = useTrainingRealtime(training?.id ?? null, handleRealtimeMessage);

  useEffect(() => {
    void load();
    const intervalMs = realtimeState === "connected" ? 30_000 : 5_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && busy === null) void load(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [load, busy, realtimeState]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const rankedBoards = useMemo(
    () => sortBoardsByCoachPriority(training?.boards ?? [], clock),
    [training, clock],
  );

  const summary = useMemo(() => {
    const boards = training?.boards ?? [];
    return {
      active: boards.filter((board) => board.status === "RUNNING").length,
      attention: boards.filter((board) => ["critical", "warning"].includes(getBoardCoachHealth(board, clock).level)).length,
      completed: boards.filter((board) => board.status === "COMPLETED").length,
      progress: boards.length ? Math.round(boards.reduce((sum, board) => sum + board.progressPercent, 0) / boards.length) : 0,
    };
  }, [training, clock]);

  async function runAction(board: LiveBoardSnapshot, action: "pause" | "resume" | "finish_exercise") {
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

  const connectionLabel = realtimeState === "connected" ? "Echtzeit" : realtimeState === "connecting" ? "Verbinden" : "Fallback";

  return (
    <main className="phase6-coach-view">
      <header className="phase6-coach-header">
        <div><span>COACH VIEW</span><h1>{training.trainingPlan.title}</h1><p>{training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten</p></div>
        <div className="phase6-coach-header-actions"><div><i /><strong>{connectionLabel}</strong><small>{lastUpdated?.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></div><Link href="/trainer/live">Control Center</Link></div>
      </header>

      <section className="phase6-coach-kpis">
        <article><span>Gesamtfortschritt</span><strong>{summary.progress}%</strong><i><b style={{ width: `${summary.progress}%` }} /></i></article>
        <article><span>Aktive Boards</span><strong>{summary.active}</strong></article>
        <article className={summary.attention > 0 ? "is-alert" : ""}><span>Trainer prüfen</span><strong>{summary.attention}</strong></article>
        <article><span>Fertig</span><strong>{summary.completed}</strong></article>
      </section>

      <section className="phase6-coach-board-list">
        {rankedBoards.map(({ board, health }, index) => (
          <article className={`phase6-coach-board is-${health.level}`} key={board.id}>
            <div className="phase6-coach-rank"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
            <div className="phase6-coach-board-main">
              <header><div><small>{board.board.name}</small><h2>{board.currentExercise?.name ?? health.label}</h2></div><span>{health.label}</span></header>
              <div className="phase6-coach-player"><strong>{board.currentPlayer?.displayName ?? board.players[0]?.displayName ?? "Kein Spieler"}</strong><small>{board.players.map((player) => player.displayName).join(" · ") || "Board frei"}</small></div>
              <div className="phase6-coach-progress"><i><b style={{ width: `${board.progressPercent}%` }} /></i><strong>{board.progressPercent}%</strong></div>
              <footer><span>{health.detail}</span><span>{board.resultCount} Ergebnisse</span></footer>
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
