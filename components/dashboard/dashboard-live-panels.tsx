"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type InsightAlert = {
  level: "success" | "warning" | "critical";
  title: string;
  text: string;
  href: string;
};

type InsightPayload = {
  topPlayers: { playerId: number; name: string; results: number; activeDays: number; average: number | null }[];
  topExercises: { exerciseId: number; name: string; results: number; players: number }[];
  heatmap: { date: string; count: number }[];
  homeTraining: { openSessions: number; plans: number; staleSessions: number };
  cadence: {
    completedLast14Days: number;
    expectedLast14Days: number;
    percentage: number;
    targetPerWeek: number;
  };
  inactivePlayers: { playerId: number; name: string }[];
  alerts: InsightAlert[];
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
let insightRequest: Promise<InsightPayload> | null = null;

function loadDashboardInsights() {
  if (!insightRequest) {
    insightRequest = fetch("/api/trainer/dashboard-insights", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Dashboard-Auswertung konnte nicht geladen werden.");
        return response.json() as Promise<InsightPayload>;
      })
      .catch((error) => {
        insightRequest = null;
        throw error;
      });
  }
  return insightRequest;
}

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

export function DashboardCoachBriefing() {
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadDashboardInsights()
      .then((payload) => {
        if (active) setInsights(payload);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="vdc-v3-coach-card vdc-v3-coach-briefing">
      <header>
        <div><span className="vdc-kicker">Coach Briefing</span><h2>Trainerhinweise</h2></div>
        <span>AI</span>
      </header>

      {!insights && !failed && (
        <div className="vdc-v3-coach-loading" aria-label="Coach-Briefing wird geladen">
          <span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />
        </div>
      )}

      {failed && (
        <div className="vdc-empty-line">Die aktuellen Trainerhinweise konnten nicht geladen werden.</div>
      )}

      {insights && (
        <>
          <section className="vdc-v3-cadence">
            <div>
              <small>Trainingsrhythmus</small>
              <strong>{insights.cadence.completedLast14Days}/{insights.cadence.expectedLast14Days}</strong>
              <span>Einheiten in 14 Tagen · Ziel {insights.cadence.targetPerWeek}× pro Woche</span>
            </div>
            <div className="vdc-v3-cadence-track" aria-label={`${insights.cadence.percentage} Prozent des Trainingsziels erreicht`}>
              <i style={{ width: `${insights.cadence.percentage}%` }} />
            </div>
          </section>

          <div className="vdc-v3-alert-list">
            {insights.alerts.map((alert) => (
              <Link href={alert.href} className={`is-${alert.level}`} key={`${alert.level}-${alert.title}`}>
                <i aria-hidden="true" />
                <span><strong>{alert.title}</strong><small>{alert.text}</small></span>
                <b>→</b>
              </Link>
            ))}
          </div>

          {insights.inactivePlayers.length > 0 && (
            <div className="vdc-v3-inactive-players">
              <small>Ohne Ergebnis in den letzten 28 Tagen</small>
              <div>
                {insights.inactivePlayers.map((player) => (
                  <Link href={`/trainer/spieler/${player.playerId}`} key={player.playerId}>{player.name}</Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function DashboardActivity({ initialResults }: ActivityProps) {
  const [results, setResults] = useState(initialResults);
  const [insights, setInsights] = useState<InsightPayload | null>(null);

  useEffect(() => {
    const onLiveUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<LivePayload>;
      if (Array.isArray(customEvent.detail?.results)) setResults(customEvent.detail.results);
    };
    window.addEventListener(liveEventName, onLiveUpdate);
    return () => window.removeEventListener(liveEventName, onLiveUpdate);
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboardInsights()
      .then((payload) => {
        if (active) setInsights(payload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const maxHeat = useMemo(
    () => Math.max(1, ...(insights?.heatmap.map((item) => item.count) ?? [1])),
    [insights],
  );

  return (
    <article className="vdc-v3-activity-card vdc-v3-activity-expanded">
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

      {!insights ? (
        <div className="vdc-v3-insight-loading" aria-label="Dashboard-Auswertung wird geladen">
          <span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />
        </div>
      ) : (
        <div className="vdc-v3-insight-stack">
          <section className="vdc-v3-heatmap-panel">
            <header><div><small>Trainingsrhythmus</small><strong>Letzte 8 Wochen</strong></div><span>{insights.heatmap.reduce((sum, item) => sum + item.count, 0)} Ergebnisse</span></header>
            <div className="vdc-v3-heatmap" aria-label="Trainingsaktivität der letzten 56 Tage">
              {insights.heatmap.map((item) => {
                const level = item.count === 0 ? 0 : Math.max(1, Math.ceil((item.count / maxHeat) * 4));
                return <span key={item.date} className={`level-${level}`} title={`${new Date(`${item.date}T12:00:00`).toLocaleDateString("de-DE")}: ${item.count} Ergebnisse`} />;
              })}
            </div>
          </section>

          <div className="vdc-v3-ranking-grid">
            <section>
              <header><small>Top-Spieler</small><Link href="/trainer/statistiken">Alle →</Link></header>
              <div className="vdc-v3-mini-ranking">
                {insights.topPlayers.slice(0, 3).map((player, index) => (
                  <Link href={`/trainer/spieler/${player.playerId}`} key={player.playerId}>
                    <b>{index + 1}</b><span><strong>{player.name}</strong><small>{player.activeDays} aktive Tage</small></span><em>{player.results}</em>
                  </Link>
                ))}
                {insights.topPlayers.length === 0 && <p>Noch keine auswertbaren Spielergebnisse.</p>}
              </div>
            </section>

            <section>
              <header><small>Übungsranking</small><Link href="/trainer/uebungen">Katalog →</Link></header>
              <div className="vdc-v3-mini-ranking">
                {insights.topExercises.slice(0, 3).map((exercise, index) => (
                  <div key={exercise.exerciseId}>
                    <b>{index + 1}</b><span><strong>{exercise.name}</strong><small>{exercise.players} Spieler</small></span><em>{exercise.results}</em>
                  </div>
                ))}
                {insights.topExercises.length === 0 && <p>Noch keine Übungsdaten vorhanden.</p>}
              </div>
            </section>
          </div>

          <Link className="vdc-v3-home-summary" href="/trainer/heimtraining">
            <span>⌂</span>
            <div><small>Heimtraining</small><strong>{insights.homeTraining.openSessions} offene Sessions</strong><p>{insights.homeTraining.plans} persönliche Pläne verfügbar</p></div>
            <b>→</b>
          </Link>
        </div>
      )}
    </article>
  );
}
