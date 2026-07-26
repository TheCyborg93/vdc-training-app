"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";
import styles from "./trainer-live.module.css";

type Player = { id: number; displayName: string };
type LiveBoard = {
  id: number;
  board: { id: number; name: string };
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  lastResultAt: string | null;
  players: Player[];
  currentPlayer: Player | null;
  currentExercise: { id: number; name: string; description: string } | null;
  exerciseIndex: number;
  totalExercises: number;
  progressPercent: number;
  resultCount: number;
};
type LiveTraining = {
  id: number;
  trainingDate: string;
  status: string;
  trainingPlan: { title: string; goal: string; durationMin: number };
  boards: LiveBoard[];
};
type ControlAction = "pause" | "resume" | "skip" | "finish_exercise" | "finish_board" | "reorder";
type TimelineItem = { id: string; time: Date; board: string; text: string; tone: "info" | "success" | "warning" };
type Health = { level: "good" | "warning" | "critical" | "done" | "waiting"; label: string; detail: string };

type BoardDetailProps = {
  board: LiveBoard;
  order: number[];
  busy: boolean;
  onControl: (board: LiveBoard, action: ControlAction, extra?: Record<string, unknown>) => Promise<void>;
  onMovePlayer: (boardId: number, index: number, direction: -1 | 1) => void;
};

function statusLabel(status: string) {
  if (status === "RUNNING") return "Läuft";
  if (status === "COMPLETED") return "Abgeschlossen";
  if (status === "PAUSED") return "Pausiert";
  return "Noch nicht gestartet";
}

function statusDescription(status: string) {
  if (status === "RUNNING") return "Ergebnisse können am Board eingetragen werden.";
  if (status === "PAUSED") return "Der aktuelle Stand ist gespeichert.";
  if (status === "COMPLETED") return "Dieses Board-Training ist beendet.";
  return "Das Board wartet auf den Trainingsstart.";
}

function minutesSince(value: string | null, now: Date) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
}

function boardHealth(board: LiveBoard, now: Date): Health {
  if (board.status === "COMPLETED") return { level: "done", label: "Fertig", detail: "Board-Training abgeschlossen" };
  if (board.status === "PAUSED") return { level: "warning", label: "Pausiert", detail: "Fortsetzen oder Status prüfen" };
  if (board.status === "NOT_STARTED") return { level: "waiting", label: "Wartet", detail: "Noch nicht gestartet" };
  const idle = minutesSince(board.lastResultAt ?? board.startedAt, now) ?? 0;
  if (idle >= 7) return { level: "critical", label: "Eingreifen", detail: `Seit ${idle} Min. kein Ergebnis` };
  if (idle >= 3) return { level: "warning", label: "Beobachten", detail: `Seit ${idle} Min. kein Ergebnis` };
  return { level: "good", label: "Läuft gut", detail: board.lastResultAt ? `Letztes Ergebnis vor ${idle} Min.` : "Gerade gestartet" };
}

function createTimeline(previous: LiveTraining | null, next: LiveTraining): TimelineItem[] {
  if (!previous) return [{ id: `load-${Date.now()}`, time: new Date(), board: "Training", text: "Live Center verbunden", tone: "info" }];
  const events: TimelineItem[] = [];
  for (const board of next.boards) {
    const before = previous.boards.find((item) => item.id === board.id);
    if (!before) continue;
    if (before.status !== board.status) {
      const text = board.status === "RUNNING" ? "Training läuft" : board.status === "PAUSED" ? "Board pausiert" : board.status === "COMPLETED" ? "Board abgeschlossen" : statusLabel(board.status);
      events.push({ id: `${board.id}-status-${Date.now()}`, time: new Date(), board: board.board.name, text, tone: board.status === "COMPLETED" ? "success" : board.status === "PAUSED" ? "warning" : "info" });
    }
    if (before.currentExercise?.id !== board.currentExercise?.id && board.currentExercise) {
      events.push({ id: `${board.id}-exercise-${Date.now()}`, time: new Date(), board: board.board.name, text: `Neue Übung: ${board.currentExercise.name}`, tone: "info" });
    }
    if (before.currentPlayer?.id !== board.currentPlayer?.id && board.currentPlayer) {
      events.push({ id: `${board.id}-player-${Date.now()}`, time: new Date(), board: board.board.name, text: `${board.currentPlayer.displayName} ist am Zug`, tone: "info" });
    }
    if (board.resultCount > before.resultCount) {
      const amount = board.resultCount - before.resultCount;
      events.push({ id: `${board.id}-result-${Date.now()}`, time: new Date(), board: board.board.name, text: `${amount} ${amount === 1 ? "Ergebnis" : "Ergebnisse"} gespeichert`, tone: "success" });
    }
  }
  return events;
}

function BoardDetail({ board, order, busy, onControl, onMovePlayer }: BoardDetailProps) {
  const orderedPlayers = order.map((id) => board.players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const active = board.status === "RUNNING" || board.status === "PAUSED";
  const finalExercise = board.exerciseIndex + 1 >= board.totalExercises;

  return (
    <div className="trainer-focus-content" aria-busy={busy}>
      <header className="trainer-focus-board-head">
        <div><span className="trainer-board-label">{board.board.name}</span><h2>{statusLabel(board.status)}</h2><p>{statusDescription(board.status)}</p></div>
        <span className={`vdc-status-badge is-${board.status.toLowerCase()}`}><i />{statusLabel(board.status)}</span>
      </header>
      <section className="trainer-live-progress-block trainer-focus-progress">
        <div><small>Trainingsfortschritt</small><strong>{board.progressPercent}%</strong></div>
        <div className="trainer-progress"><span style={{ width: `${board.progressPercent}%` }} /></div>
        <div className="trainer-progress-copy"><span>Übung {board.status === "COMPLETED" ? board.totalExercises : Math.min(board.exerciseIndex + 1, board.totalExercises)} von {board.totalExercises}</span><span>{board.resultCount} Ergebnisse</span></div>
      </section>
      <div className="trainer-live-focus-grid">
        <section className="trainer-current"><small>Aktuelle Übung</small><strong>{board.currentExercise?.name ?? (board.status === "COMPLETED" ? "Training abgeschlossen" : "Noch nicht gestartet")}</strong>{board.currentExercise?.description && <p>{board.currentExercise.description}</p>}</section>
        <section className="trainer-current-player"><small>Aktiver Spieler</small><strong>{board.currentPlayer?.displayName ?? "—"}</strong><span>{board.players.length} Spieler am Board</span></section>
      </div>
      <section className="trainer-control-section trainer-focus-controls">
        <header><small>Boardsteuerung</small><span>{busy ? "Aktion läuft …" : "Bereit"}</span></header>
        <div className="trainer-primary-controls">
          {board.status === "RUNNING" && <button className="button secondary" disabled={busy} onClick={() => void onControl(board, "pause")}>Training pausieren</button>}
          {board.status === "PAUSED" && <button className="button" disabled={busy} onClick={() => void onControl(board, "resume")}>Training fortsetzen</button>}
          {board.status === "RUNNING" && board.players.length > 1 && <button className="button secondary" disabled={busy} onClick={() => void onControl(board, "skip")}>Nächster Spieler</button>}
        </div>
        {active && <div className="trainer-exercise-controls"><button className="button" disabled={busy || !board.currentExercise} onClick={() => void onControl(board, "finish_exercise")}>{finalExercise ? "Letzte Übung abschließen" : "Übung abschließen & weiter"}</button><button className="button danger-outline" disabled={busy} onClick={() => void onControl(board, "finish_board")}>Board-Training beenden</button></div>}
      </section>
      <section className="trainer-order-box trainer-focus-order">
        <div className="trainer-order-head"><div><small>Spielerreihenfolge</small><span>Aktiver Spieler bleibt nach dem Speichern erhalten.</span></div><button className="button secondary" disabled={busy || !active} onClick={() => void onControl(board, "reorder", { order })}>Reihenfolge speichern</button></div>
        <div className="trainer-order-list">
          {orderedPlayers.map((player, index) => <div className={board.currentPlayer?.id === player.id ? "is-current" : ""} key={player.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{player.displayName}</strong>{board.currentPlayer?.id === player.id && <small>Aktuell am Zug</small>}</div><div className="trainer-order-actions"><button disabled={busy || !active || index === 0} onClick={() => onMovePlayer(board.id, index, -1)} aria-label={`${player.displayName} nach oben verschieben`}>↑</button><button disabled={busy || !active || index === orderedPlayers.length - 1} onClick={() => onMovePlayer(board.id, index, 1)} aria-label={`${player.displayName} nach unten verschieben`}>↓</button></div></div>)}
          {orderedPlayers.length === 0 && <div className="vdc-empty-line">Keine Spieler zugewiesen.</div>}
        </div>
      </section>
    </div>
  );
}

export default function TrainerLivePage() {
  const { confirm, notify } = useAppFeedback();
  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyBoardId, setBusyBoardId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [orders, setOrders] = useState<Record<number, number[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [clock, setClock] = useState(new Date());

  async function loadLiveData(silent = false) {
    try {
      const response = await fetch("/api/trainer/live", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Live-Daten konnten nicht geladen werden.");
      setTraining((current) => {
        if (data) {
          const events = createTimeline(current, data as LiveTraining);
          if (events.length) setTimeline((items) => [...events, ...items].slice(0, 16));
        }
        return data;
      });
      setLastUpdated(new Date());
      if (data?.boards) {
        setOrders((current) => {
          const next = { ...current };
          for (const board of data.boards as LiveBoard[]) {
            const currentOrder = next[board.id] ?? [];
            const playerIds = board.players.map((player) => player.id);
            const samePlayers = currentOrder.length === playerIds.length && currentOrder.every((id) => playerIds.includes(id));
            if (!samePlayers) next[board.id] = playerIds;
          }
          return next;
        });
        setSelectedBoardId((current) => current && (data.boards as LiveBoard[]).some((board) => board.id === current) ? current : (data.boards as LiveBoard[])[0]?.id ?? null);
      }
      if (!silent) setMessage("");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Live-Daten konnten nicht geladen werden.";
      setMessage(text);
      if (!silent) notify("Live Center nicht erreichbar", { message: text, tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveData();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && busyBoardId === null && !bulkBusy) void loadLiveData(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [busyBoardId, bulkBusy]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedBoardId(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const summary = useMemo(() => {
    const boards = training?.boards ?? [];
    const averageProgress = boards.length ? Math.round(boards.reduce((sum, board) => sum + board.progressPercent, 0) / boards.length) : 0;
    return {
      running: boards.filter((board) => board.status === "RUNNING").length,
      waiting: boards.filter((board) => board.status === "NOT_STARTED").length,
      paused: boards.filter((board) => board.status === "PAUSED").length,
      completed: boards.filter((board) => board.status === "COMPLETED").length,
      results: boards.reduce((sum, board) => sum + board.resultCount, 0),
      averageProgress,
    };
  }, [training]);

  const timing = useMemo(() => {
    const starts = (training?.boards ?? []).map((board) => board.startedAt).filter((value): value is string => Boolean(value)).map((value) => new Date(value).getTime());
    const startedAt = starts.length ? Math.min(...starts) : null;
    const elapsed = startedAt ? Math.max(0, Math.floor((clock.getTime() - startedAt) / 60_000)) : 0;
    const planned = training?.trainingPlan.durationMin ?? 0;
    return { elapsed, remaining: Math.max(0, planned - elapsed), planned };
  }, [training, clock]);

  const selectedBoard = training?.boards.find((board) => board.id === selectedBoardId) ?? null;
  const selectedIndex = selectedBoard && training ? training.boards.findIndex((board) => board.id === selectedBoard.id) : -1;

  async function requestConfirmation(board: LiveBoard, action: ControlAction) {
    if (action === "finish_exercise") {
      const finalExercise = board.exerciseIndex + 1 >= board.totalExercises;
      return confirm({ title: finalExercise ? "Letzte Übung abschließen?" : "Aktuelle Übung abschließen?", message: finalExercise ? `Damit wird die letzte Übung an ${board.board.name} beendet und das Board-Training abgeschlossen.` : `Die aktuelle Übung an ${board.board.name} wird beendet. Anschließend wird die nächste Übung mit einer neuen zufälligen Reihenfolge vorbereitet.`, confirmLabel: finalExercise ? "Training abschließen" : "Nächste Übung starten", cancelLabel: "Weiter trainieren", destructive: finalExercise });
    }
    if (action === "finish_board") return confirm({ title: `Training an ${board.board.name} beenden?`, message: "Das gesamte Board-Training wird sofort abgeschlossen. Nicht beendete Übungen werden übersprungen, vorhandene Ergebnisse bleiben gespeichert.", confirmLabel: "Board-Training beenden", cancelLabel: "Abbrechen", destructive: true });
    return true;
  }

  async function control(board: LiveBoard, action: ControlAction, extra: Record<string, unknown> = {}) {
    if (!(await requestConfirmation(board, action))) return;
    setBusyBoardId(board.id);
    setMessage("");
    try {
      const response = await fetch("/api/trainer/live/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardSessionId: board.id, action, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Traineraktion fehlgeschlagen.");
      const text = data.message ?? "Aktion ausgeführt.";
      setMessage(`${board.board.name}: ${text}`);
      notify(text, { message: board.board.name, tone: action === "finish_board" || data.completed ? "success" : "info" });
      await loadLiveData(true);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Traineraktion fehlgeschlagen.";
      setMessage(text);
      notify("Aktion nicht möglich", { message: text, tone: "error" });
    } finally { setBusyBoardId(null); }
  }

  async function bulkControl(action: "pause_all" | "resume_all") {
    if (!training) return;
    setBulkBusy(true);
    try {
      const response = await fetch("/api/trainer/live/bulk-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingDayId: training.id, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sammelaktion fehlgeschlagen.");
      notify(data.message ?? "Sammelaktion ausgeführt.", { tone: "success" });
      await loadLiveData(true);
    } catch (error) {
      notify("Sammelaktion nicht möglich", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally { setBulkBusy(false); }
  }

  function movePlayer(boardId: number, index: number, direction: -1 | 1) {
    setOrders((current) => {
      const order = [...(current[boardId] ?? [])];
      const target = index + direction;
      if (target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, [boardId]: order };
    });
  }

  function selectRelativeBoard(direction: -1 | 1) {
    if (!training?.boards.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + direction + training.boards.length) % training.boards.length;
    setSelectedBoardId(training.boards[nextIndex].id);
  }

  if (loading) return <main className={`${styles.root} dashboard-page`}><section className="trainer-live-loading" aria-label="Live Center wird geladen"><div /><div /><div /></section></main>;
  if (!training) return <main className={`${styles.root} dashboard-page`}><section className="vdc-empty-state trainer-live-empty"><span aria-hidden="true">◎</span><strong>Kein Live-Training aktiv</strong><p>{message || "Aktuell ist kein Trainingstag veröffentlicht oder gestartet."}</p><button className="button secondary" onClick={() => void loadLiveData()}>Erneut prüfen</button></section></main>;

  return (
    <main className={`${styles.root} dashboard-page trainer-live-page trainer-cockpit-page`}>
      <header className="vdc-page-heading trainer-live-heading">
        <div><span className="vdc-kicker">Trainersteuerung</span><h1>Live Center</h1><p>{training.trainingPlan.title} · {training.trainingPlan.goal} · {training.trainingPlan.durationMin} Minuten</p></div>
        <div className="trainer-live-refresh"><span><i />Automatische Aktualisierung</span><small>{lastUpdated ? `Stand ${lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Wird geladen"}</small><button className="button secondary" disabled={busyBoardId !== null || bulkBusy} onClick={() => void loadLiveData()}>Jetzt aktualisieren</button></div>
      </header>

      <section className="trainer-cockpit-overview">
        <article className="trainer-cockpit-progress"><div><span className="vdc-kicker">Training läuft</span><strong>{summary.averageProgress}%</strong><p>{summary.completed} von {training.boards.length} Boards abgeschlossen</p></div><div className="trainer-cockpit-bar"><span style={{ width: `${summary.averageProgress}%` }} /></div></article>
        <div className="trainer-cockpit-metrics"><article><small>Vergangene Zeit</small><strong>{timing.elapsed} Min.</strong><span>von {timing.planned} Minuten</span></article><article><small>Restzeit geplant</small><strong>{timing.remaining} Min.</strong><span>{timing.remaining === 0 && timing.elapsed > timing.planned ? "Planzeit überschritten" : "bis Planende"}</span></article><article><small>Ergebnisse</small><strong>{summary.results}</strong><span>gesamt gespeichert</span></article></div>
        <div className="trainer-cockpit-actions"><button className="button secondary" disabled={bulkBusy || summary.running === 0} onClick={() => void bulkControl("pause_all")}>Alle Boards pausieren</button><button className="button" disabled={bulkBusy || summary.paused === 0} onClick={() => void bulkControl("resume_all")}>Alle Boards fortsetzen</button></div>
      </section>

      <section className="trainer-live-summary"><article><small>Laufende Boards</small><strong>{summary.running}</strong><span>aktive Gruppen</span></article><article><small>Pausierte Boards</small><strong>{summary.paused}</strong><span>Stand gespeichert</span></article><article><small>Wartende Boards</small><strong>{summary.waiting}</strong><span>noch nicht gestartet</span></article><article><small>Abgeschlossen</small><strong>{summary.completed}</strong><span>fertige Boards</span></article><article><small>Ergebnisse</small><strong>{summary.results}</strong><span>gespeicherte Einträge</span></article></section>
      {message && <p className="form-message trainer-live-message">{message}</p>}

      <section className="trainer-cockpit-layout">
        <div className="trainer-cockpit-board-area">
          <nav className="trainer-board-switcher" aria-label="Board auswählen">{training.boards.map((board) => <button key={board.id} className={selectedBoardId === board.id ? "is-active" : ""} onClick={() => setSelectedBoardId(board.id)}><i className={`status-${board.status.toLowerCase()}`} /><span>{board.board.name}</span><small>{board.progressPercent}%</small></button>)}</nav>
          <section className="trainer-live-grid trainer-board-wall-v4">
            {training.boards.map((board) => {
              const health = boardHealth(board, clock);
              return <article className={`trainer-live-card trainer-board-overview status-${board.status.toLowerCase()} health-${health.level}`} key={board.id} aria-busy={busyBoardId === board.id}>
                <header className="trainer-live-card-head"><div><span className="trainer-board-label">{board.board.name}</span><h2>{statusLabel(board.status)}</h2></div><span className={`trainer-health-badge is-${health.level}`}><i />{health.label}</span></header>
                <div className="trainer-board-health-detail">{health.detail}</div>
                <div className="trainer-board-overview-main"><div className="trainer-board-progress-ring" style={{ "--board-progress": `${board.progressPercent * 3.6}deg` } as CSSProperties}><strong>{board.progressPercent}%</strong><small>Fortschritt</small></div><div className="trainer-board-overview-copy"><small>Aktuelle Übung</small><strong>{board.currentExercise?.name ?? (board.status === "COMPLETED" ? "Training abgeschlossen" : "Noch nicht gestartet")}</strong><span>{board.currentPlayer?.displayName ?? "Kein aktiver Spieler"}</span></div></div>
                <div className="trainer-board-overview-meta"><span>Übung {board.status === "COMPLETED" ? board.totalExercises : Math.min(board.exerciseIndex + 1, board.totalExercises)} / {board.totalExercises}</span><span>{board.players.length} Spieler</span><span>{board.resultCount} Ergebnisse</span></div>
                <button className="button secondary trainer-board-focus-button" onClick={() => setSelectedBoardId(board.id)}>Board steuern</button>
              </article>;
            })}
          </section>
        </div>
        <aside className="trainer-cockpit-timeline"><header><div><span className="vdc-kicker">Live Timeline</span><h2>Aktivitäten</h2></div><span>{timeline.length}</span></header><div>{timeline.map((item) => <article className={`is-${item.tone}`} key={item.id}><time>{item.time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><div><strong>{item.board}</strong><p>{item.text}</p></div></article>)}{timeline.length === 0 && <p className="vdc-empty-line">Änderungen erscheinen hier automatisch.</p>}</div></aside>
      </section>

      {selectedBoard && <div className="trainer-focus-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBoardId(null); }}><aside className="trainer-focus-drawer" role="dialog" aria-modal="true" aria-label={`${selectedBoard.board.name} steuern`}><div className="trainer-focus-toolbar"><div className="trainer-focus-navigation"><button onClick={() => selectRelativeBoard(-1)} aria-label="Vorheriges Board">←</button><span>{selectedIndex + 1} / {training.boards.length}</span><button onClick={() => selectRelativeBoard(1)} aria-label="Nächstes Board">→</button></div><button className="trainer-focus-close" onClick={() => setSelectedBoardId(null)} aria-label="Fokusansicht schließen">×</button></div><BoardDetail board={selectedBoard} order={orders[selectedBoard.id] ?? selectedBoard.players.map((player) => player.id)} busy={busyBoardId === selectedBoard.id} onControl={control} onMovePlayer={movePlayer} /></aside></div>}
    </main>
  );
}
