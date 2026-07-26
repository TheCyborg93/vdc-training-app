"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BoardStatus = {
  boardId: number;
  name: string;
  status: string;
  exerciseName: string | null;
};

type ResultItem = {
  id: number;
  playerName: string;
  exerciseName: string;
  calculatedScore: number | null;
  createdAt: string;
};

type LivePayload = {
  trainingId: number | null;
  boards: BoardStatus[];
  runningBoards: number;
  occupiedBoards: number;
  completedBoards: number;
  results: ResultItem[];
  updatedAt: string;
};

type BoardWallProps = {
  initialBoards: BoardStatus[];
  initialRunningBoards: number;
  initialOccupiedBoards: number;
  initialCompletedBoards: number;
};

type ActivityProps = {
  initialResults: ResultItem[];
};

const liveEventName = "vdc-dashboard-live";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: "Wartet",
    RUNNING: "Läuft",
    PAUSED: "Pausiert",
    COMPLETED: "Abgeschlossen",
  };
  return labels[status] ?? status;
}

export function DashboardBoardWall({
  initialBoards,
  initialRunningBoards,
  initialOccupiedBoards,
  initialCompletedBoards,
}: BoardWallProps) {
  const [payload, setPayload] = useState<Pick<LivePayload, "boards" | "runningBoards" | "occupiedBoards" | "completedBoards" | "updatedAt">>({
    boards: initialBoards,
    runningBoards: initialRunningBoards,
    occupiedBoards: initialOccupiedBoards,
    completedBoards: initialCompletedBoards,
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch("/api/trainer/dashboard-live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = (await response.json()) as LivePayload;
        if (!active) return;
        setPayload(next);
        window.dispatchEvent(new CustomEvent<LivePayload>(liveEventName, { detail: next }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const interval = window.setInterval(() => void refresh(), 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <aside className="vdc-v3-board-wall">
      <header>
        <div><span className="vdc-kicker">Live Monitor</span><h2>Board Wall</h2></div>
        <strong>{payload.runningBoards} live</strong>
      </header>
      <div className="vdc-v3-board-list">
        {payload.boards.map((board) => (
          <div key={board.boardId} className={`is-${board.status.toLowerCase()}`}>
            <span className={`vdc-board-dot is-${board.status.toLowerCase()}`} />
            <div>
              <strong>{board.name}</strong>
              <small>{board.exerciseName ?? statusLabel(board.status)}</small>
            </div>
            <b>{board.status === "RUNNING" ? "LIVE" : statusLabel(board.status)}</b>
          </div>
        ))}
        {payload.boards.length === 0 && <div className="vdc-empty-line">Noch keine Boards zugewiesen.</div>}
      </div>
      <div className="vdc-v3-board-summary">
        <span>{payload.occupiedBoards} belegt</span>
        <span>{payload.completedBoards} abgeschlossen</span>
      </div>
      <Link className="vdc-text-link" href="/trainer/live">Live Center öffnen →</Link>
    </aside>
  );
}

export function DashboardActivity({ initialResults }: ActivityProps) {
  const [results, setResults] = useState(initialResults);

  useEffect(() => {
    const onLiveUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<LivePayload>;
      if (Array.isArray(customEvent.detail?.results)) setResults(customEvent.detail.results);
    };
    window.addEventListener(liveEventName, onLiveUpdate);
    return () => window.removeEventListener(liveEventName, onLiveUpdate);
  }, []);

  return (
    <article className="vdc-v3-activity-card">
      <header className="vdc-section-heading"><div><span className="vdc-kicker">Aktivität</span><h2>Letzte Ergebnisse</h2></div></header>
      <div className="vdc-result-list">
        {results.slice(0, 6).map((item) => (
          <div key={item.id}>
            <div><strong>{item.playerName}</strong><small>{item.exerciseName}</small></div>
            <time>{new Date(item.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
            <b>{item.calculatedScore ?? "–"}</b>
          </div>
        ))}
        {results.length === 0 && <div className="vdc-empty-line">Noch keine Ergebnisse vorhanden.</div>}
      </div>
    </article>
  );
}
