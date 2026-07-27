"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LiveBoardManagement from "@/components/trainer/LiveBoardManagement";
import { useAppFeedback } from "@/components/ui/app-feedback";
import {
  coachHealthPriority,
  getBoardCoachHealth,
} from "@/lib/live-training/health";
import type {
  LiveBoardSnapshot,
  LiveTrainingSnapshot,
} from "@/lib/live-training/types";

type TimelineItem = {
  id: string;
  time: Date;
  board: string;
  text: string;
  tone: "info" | "success" | "warning";
};

type BoardAction = "pause" | "resume" | "skip" | "finish_exercise" | "finish_board";
type BulkAction = Exclude<BoardAction, "skip">;

function statusLabel(status: LiveBoardSnapshot["status"]) {
  if (status === "RUNNING") return "Aktiv";
  if (status === "PAUSED") return "Pause";
  if (status === "COMPLETED") return "Fertig";
  return "Wartet";
}

function formatDuration(
  start: string | Date | null,
  end: string | Date | null,
  now: Date,
) {
  if (!start) return "00:00";
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : now.getTime();
  const seconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function buildTimeline(
  previous: LiveTrainingSnapshot | null,
  next: LiveTrainingSnapshot,
): TimelineItem[] {
  if (!previous) {
    return [
      {
        id: `connected-${Date.now()}`,
        time: new Date(),
        board: "System",
        text: "Live Control Center verbunden",
        tone: "info",
      },
    ];
  }

  const items: TimelineItem[] = [];
  for (const board of next.boards) {
    const before = previous.boards.find((entry) => entry.id === board.id);
    if (!before) continue;

    if (before.status !== board.status) {
      items.push({
        id: `${board.id}-status-${Date.now()}`,
        time: new Date(),
        board: board.board.name,
        text: statusLabel(board.status),
        tone:
          board.status === "COMPLETED"
            ? "success"
            : board.status === "PAUSED"
              ? "warning"
              : "info",
      });
    }

    if (
      before.currentExercise?.id !== board.currentExercise?.id &&
      board.currentExercise
    ) {
      items.push({
        id: `${board.id}-exercise-${Date.now()}`,
        time: new Date(),
        board: board.board.name,
        text: `Neue Übung: ${board.currentExercise.name}`,
        tone: "info",
      });
    }

    if (board.resultCount > before.resultCount) {
      const count = board.resultCount - before.resultCount;
      items.push({
        id: `${board.id}-result-${Date.now()}`,
        time: new Date(),
        board: board.board.name,
        text: `${count} ${count === 1 ? "Ergebnis" : "Ergebnisse"} gespeichert`,
        tone: "success",
      });
    }
  }

  return items;
}

export default function TrainerLivePage() {
  const { confirm, notify } = useAppFeedback();
  const [training, setTraining] = useState<LiveTrainingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [busyBoardId, setBusyBoardId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const trainingIdRef = useRef<number | null>(null);
  const statusRef = useRef<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        const query = trainingIdRef.current
          ? `?trainingId=${trainingIdRef.current}`
          : "";
        const response = await fetch(`/api/trainer/live${query}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | LiveTrainingSnapshot
          | { error?: string }
          | null;

        if (!response.ok) {
          const errorPayload = payload as { error?: string } | null;
          throw new Error(
            errorPayload?.error ?? "Live-Daten konnten nicht geladen werden.",
          );
        }

        const nextTraining = payload as LiveTrainingSnapshot | null;
        setTraining((current) => {
          if (nextTraining) {
            const events = buildTimeline(current, nextTraining);
            if (events.length) {
              setTimeline((items) => [...events, ...items].slice(0, 20));
            }
            trainingIdRef.current = nextTraining.id;
            statusRef.current = nextTraining.status;
          }
          return nextTraining;
        });
        setLastUpdated(new Date());

        if (nextTraining?.boards.length) {
          setSelectedBoardId((current) =>
            current && nextTraining.boards.some((board) => board.id === current)
              ? current
              : null,
          );
        }
      } catch (error) {
        if (!silent) {
          notify("Live Center nicht erreichbar", {
            message:
              error instanceof Error ? error.message : "Unbekannter Fehler",
            tone: "error",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        busyBoardId === null &&
        !bulkBusy &&
        statusRef.current !== "COMPLETED"
      ) {
        void load(true);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [load, busyBoardId, bulkBusy]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const boards = training?.boards ?? [];
    return {
      running: boards.filter((board) => board.status === "RUNNING").length,
      paused: boards.filter((board) => board.status === "PAUSED").length,
      completed: boards.filter((board) => board.status === "COMPLETED").length,
      waiting: boards.filter((board) => board.status === "NOT_STARTED").length,
      results: boards.reduce((sum, board) => sum + board.resultCount, 0),
      players:
        training?.roster.length ??
        new Set(
          boards.flatMap((board) => board.players.map((player) => player.id)),
        ).size,
      progress: boards.length
        ? Math.round(
            boards.reduce((sum, board) => sum + board.progressPercent, 0) /
              boards.length,
          )
        : 0,
    };
  }, [training]);

  const attention = useMemo(
    () =>
      (training?.boards ?? [])
        .map((board) => ({
          board,
          health: getBoardCoachHealth(board, clock),
        }))
        .filter((entry) =>
          ["critical", "warning", "waiting"].includes(entry.health.level),
        )
        .sort(
          (a, b) =>
            coachHealthPriority[a.health.level] -
              coachHealthPriority[b.health.level] ||
            a.board.progressPercent - b.board.progressPercent,
        ),
    [training, clock],
  );

  const selectedBoard =
    training?.boards.find((board) => board.id === selectedBoardId) ?? null;

  async function boardAction(board: LiveBoardSnapshot, action: BoardAction) {
    if (
      (action === "finish_board" || action === "finish_exercise") &&
      !(await confirm({
        title:
          action === "finish_board"
            ? `${board.board.name} beenden?`
            : "Aktuelle Übung abschließen?",
        message:
          action === "finish_board"
            ? "Das Board-Training wird vollständig beendet. Ergebnisse bleiben gespeichert."
            : "Das Board wechselt unmittelbar zur nächsten Übung.",
        confirmLabel:
          action === "finish_board" ? "Board beenden" : "Nächste Übung",
        cancelLabel: "Abbrechen",
        destructive: action === "finish_board",
      }))
    ) {
      return;
    }

    setBusyBoardId(board.id);
    try {
      const response = await fetch("/api/trainer/live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSessionId: board.id, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Aktion fehlgeschlagen.");
      }
      notify(payload.message ?? "Aktion ausgeführt.", {
        message: board.board.name,
        tone: payload.completed ? "success" : "info",
      });
      await load(true);
    } catch (error) {
      notify("Aktion nicht möglich", {
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
        tone: "error",
      });
    } finally {
      setBusyBoardId(null);
    }
  }

  async function runBulk(action: BulkAction) {
    if (!training) return;
    const candidates = training.boards.filter((board) => {
      if (action === "pause") return board.status === "RUNNING";
      if (action === "resume") return board.status === "PAUSED";
      return board.status === "RUNNING" || board.status === "PAUSED";
    });
    if (!candidates.length) return;

    if (
      (action === "finish_exercise" || action === "finish_board") &&
      !(await confirm({
        title:
          action === "finish_board"
            ? "Gesamtes Training beenden?"
            : "Alle Boards zur nächsten Übung?",
        message:
          action === "finish_board"
            ? `${candidates.length} aktive Boards werden beendet.`
            : `${candidates.length} Boards schließen ihre aktuelle Übung ab.`,
        confirmLabel:
          action === "finish_board" ? "Training beenden" : "Alle weiterschalten",
        cancelLabel: "Abbrechen",
        destructive: action === "finish_board",
      }))
    ) {
      return;
    }

    setBulkBusy(true);
    try {
      const results = await Promise.all(
        candidates.map(async (board) => {
          const response = await fetch("/api/trainer/live/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ boardSessionId: board.id, action }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(
              `${board.board.name}: ${payload.error ?? "Aktion fehlgeschlagen"}`,
            );
          }
          return payload;
        }),
      );
      notify("Sammelaktion abgeschlossen", {
        message: `${results.length} Boards aktualisiert.`,
        tone: "success",
      });
      await load(true);
    } catch (error) {
      notify("Sammelaktion fehlgeschlagen", {
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
        tone: "error",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="phase6-live">
        <div className="phase6-live-loading">
          <i />
          <i />
          <i />
        </div>
      </main>
    );
  }

  if (!training) {
    return (
      <main className="phase6-live">
        <section className="phase6-empty">
          <strong>Kein Live-Training aktiv</strong>
          <p>Veröffentliche oder starte zuerst einen Trainingstag.</p>
          <button onClick={() => void load()}>Erneut prüfen</button>
        </section>
      </main>
    );
  }

  if (training.status === "COMPLETED") {
    return (
      <main className="phase6-live">
        <section className="phase6-complete">
          <span>✓</span>
          <h1>{training.trainingPlan.title} abgeschlossen</h1>
          <p>
            {summary.players} Spieler · {summary.results} Ergebnisse ·{" "}
            {training.boards.length} Boards
          </p>
          <div>
            <Link href="/trainer/archiv">Archiv öffnen</Link>
            <Link href="/trainer/statistiken">Statistiken</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="phase6-live">
      <header className="phase6-live-header">
        <div>
          <span>LIVE TRAINING CONTROL</span>
          <h1>{training.trainingPlan.title}</h1>
          <p>
            {new Date(training.trainingDate).toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}{" "}
            · {training.trainingPlan.goal} · {training.trainingPlan.durationMin} Min.
          </p>
        </div>
        <div className="phase6-live-sync">
          <i />
          <strong>Live</strong>
          <small>
            {lastUpdated?.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </small>
        </div>
      </header>

      <section className="phase6-control-strip">
        <article className="phase6-progress">
          <div>
            <span>Gesamtfortschritt</span>
            <strong>{summary.progress}%</strong>
          </div>
          <i>
            <b style={{ width: `${summary.progress}%` }} />
          </i>
          <small>
            {summary.completed} von {training.boards.length} Boards fertig
          </small>
        </article>
        <div className="phase6-kpis">
          <article>
            <span>Aktiv</span>
            <strong>{summary.running}</strong>
          </article>
          <article>
            <span>Pause</span>
            <strong>{summary.paused}</strong>
          </article>
          <article>
            <span>Fertig</span>
            <strong>{summary.completed}</strong>
          </article>
          <article>
            <span>Offen</span>
            <strong>{summary.waiting}</strong>
          </article>
          <article>
            <span>Spieler</span>
            <strong>{summary.players}</strong>
          </article>
        </div>
      </section>

      <LiveBoardManagement
        trainingDayId={training.id}
        boards={training.boards}
        unassignedPlayers={training.unassignedPlayers}
        onChanged={() => load(true)}
      />

      <section className="phase6-live-layout">
        <div className="phase6-board-grid">
          {training.boards.map((board) => {
            const health = getBoardCoachHealth(board, clock);
            return (
              <button
                className={`phase6-board-card status-${board.status.toLowerCase()} health-${health.level}`}
                key={board.id}
                onClick={() => setSelectedBoardId(board.id)}
              >
                <header>
                  <div>
                    <span>{board.board.name}</span>
                    <strong>{statusLabel(board.status)}</strong>
                  </div>
                  <em className={`is-${health.level}`}>
                    <i />
                    {health.label}
                  </em>
                </header>
                <div className="phase6-board-players">
                  {board.players.map((player) => (
                    <span
                      className={
                        player.id === board.currentPlayer?.id ? "is-current" : ""
                      }
                      key={player.id}
                    >
                      {player.displayName}
                    </span>
                  ))}
                  {board.players.length === 0 && <span>Board frei</span>}
                </div>
                <section>
                  <small>Aktuelle Übung</small>
                  <h2>
                    {board.currentExercise?.name ??
                      (board.status === "COMPLETED"
                        ? "Training abgeschlossen"
                        : "Noch nicht gestartet")}
                  </h2>
                  <p>{health.detail}</p>
                </section>
                <div className="phase6-board-progress">
                  <div>
                    <i>
                      <b style={{ width: `${board.progressPercent}%` }} />
                    </i>
                    <strong>{board.progressPercent}%</strong>
                  </div>
                  <small>
                    Übung {Math.min(board.exerciseIndex + 1, board.totalExercises)} /{" "}
                    {board.totalExercises}
                  </small>
                </div>
                <footer>
                  <span>
                    {formatDuration(board.startedAt, board.completedAt, clock)}
                  </span>
                  <span>{board.resultCount} Ergebnisse</span>
                </footer>
              </button>
            );
          })}
        </div>

        <aside className="phase6-live-sidebar">
          <section className="phase6-radar">
            <header>
              <div>
                <span>COACH-MODUS</span>
                <h2>Aufmerksamkeit</h2>
              </div>
              <strong>{attention.length}</strong>
            </header>
            {attention.map(({ board, health }) => (
              <button
                key={board.id}
                className={`is-${health.level}`}
                onClick={() => setSelectedBoardId(board.id)}
              >
                <i />
                <div>
                  <strong>{board.board.name}</strong>
                  <span>{health.detail}</span>
                </div>
                <b>Öffnen</b>
              </button>
            ))}
            {attention.length === 0 && <p>Alle Boards laufen unauffällig.</p>}
          </section>

          <section className="phase6-timeline">
            <header>
              <span>LIVE FEED</span>
              <h2>Aktivitäten</h2>
            </header>
            {timeline.map((item) => (
              <article className={`is-${item.tone}`} key={item.id}>
                <time>
                  {item.time.toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <div>
                  <strong>{item.board}</strong>
                  <span>{item.text}</span>
                </div>
              </article>
            ))}
            {timeline.length === 0 && <p>Noch keine Änderungen.</p>}
          </section>
        </aside>
      </section>

      <nav className="phase6-global-actions">
        <button
          disabled={bulkBusy || summary.running === 0}
          onClick={() => void runBulk("pause")}
        >
          Alle pausieren
        </button>
        <button
          disabled={bulkBusy || summary.paused === 0}
          onClick={() => void runBulk("resume")}
        >
          Alle fortsetzen
        </button>
        <button
          disabled={bulkBusy || summary.running + summary.paused === 0}
          onClick={() => void runBulk("finish_exercise")}
        >
          Alle nächste Übung
        </button>
        <button
          className="is-danger"
          disabled={bulkBusy || summary.running + summary.paused === 0}
          onClick={() => void runBulk("finish_board")}
        >
          Training beenden
        </button>
      </nav>

      {selectedBoard && (
        <div
          className="phase6-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedBoardId(null);
          }}
        >
          <aside className="phase6-board-drawer" role="dialog" aria-modal="true">
            <button
              className="phase6-drawer-close"
              onClick={() => setSelectedBoardId(null)}
              aria-label="Boardsteuerung schließen"
            >
              ×
            </button>
            <header>
              <span>{selectedBoard.board.name}</span>
              <h2>
                {selectedBoard.currentExercise?.name ??
                  statusLabel(selectedBoard.status)}
              </h2>
              <p>
                {selectedBoard.players
                  .map((player) => player.displayName)
                  .join(" · ") || "Keine Spieler zugewiesen"}
              </p>
            </header>
            <div className="phase6-drawer-kpis">
              <article>
                <span>Fortschritt</span>
                <strong>{selectedBoard.progressPercent}%</strong>
              </article>
              <article>
                <span>Laufzeit</span>
                <strong>
                  {formatDuration(
                    selectedBoard.startedAt,
                    selectedBoard.completedAt,
                    clock,
                  )}
                </strong>
              </article>
              <article>
                <span>Ergebnisse</span>
                <strong>{selectedBoard.resultCount}</strong>
              </article>
              <article>
                <span>Aktiv</span>
                <strong>{selectedBoard.currentPlayer?.displayName ?? "–"}</strong>
              </article>
            </div>
            <section className="phase6-drawer-actions">
              {selectedBoard.status === "RUNNING" && (
                <button onClick={() => void boardAction(selectedBoard, "pause")}>
                  Pause
                </button>
              )}
              {selectedBoard.status === "PAUSED" && (
                <button onClick={() => void boardAction(selectedBoard, "resume")}>
                  Fortsetzen
                </button>
              )}
              {selectedBoard.status === "RUNNING" &&
                selectedBoard.players.length > 1 && (
                  <button onClick={() => void boardAction(selectedBoard, "skip")}>
                    Nächster Spieler
                  </button>
                )}
              {(selectedBoard.status === "RUNNING" ||
                selectedBoard.status === "PAUSED") && (
                <button
                  onClick={() =>
                    void boardAction(selectedBoard, "finish_exercise")
                  }
                >
                  Nächste Übung
                </button>
              )}
              {(selectedBoard.status === "RUNNING" ||
                selectedBoard.status === "PAUSED") && (
                <button
                  className="is-danger"
                  onClick={() => void boardAction(selectedBoard, "finish_board")}
                >
                  Board beenden
                </button>
              )}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
