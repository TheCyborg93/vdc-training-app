import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

function statusLabel(status?: string) {
  if (!status) return "Geplant";
  const labels: Record<string, string> = {
    PLANNED: "Geplant",
    PUBLISHED: "Veröffentlicht",
    RUNNING: "Läuft",
    COMPLETED: "Abgeschlossen",
    CANCELLED: "Abgesagt",
    NOT_STARTED: "Wartet",
    PAUSED: "Pausiert",
  };
  return labels[status] ?? status;
}

export default async function TrainerPage() {
  const [activePlayers, availableBoards, totalBoards, exerciseCount, planCount, draftCount, archiveCount, currentTraining, recentResults] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.board.count({ where: { active: true, available: true } }),
    prisma.board.count({ where: { active: true } }),
    prisma.exercise.count({ where: { active: true } }),
    prisma.trainingPlan.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.trainingPlan.count({ where: { status: "DRAFT" } }),
    prisma.trainingDay.count({ where: { status: "COMPLETED" } }),
    prisma.trainingDay.findFirst({
      where: { status: { in: ["PUBLISHED", "RUNNING"] } },
      select: {
        status: true,
        trainingDate: true,
        trainingPlan: { select: { title: true, goal: true, durationMin: true } },
        boards: { select: { boardId: true, board: { select: { name: true } } } },
        players: { select: { playerId: true } },
        sessions: { select: { boardId: true, status: true } },
      },
      orderBy: { trainingDate: "asc" },
    }),
    prisma.exerciseResult.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        calculatedScore: true,
        createdAt: true,
        player: { select: { displayName: true } },
        exercise: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const runningBoards = currentTraining?.sessions.filter((session) => session.status === "RUNNING").length ?? 0;
  const occupiedBoards = currentTraining?.sessions.filter((session) => ["RUNNING", "PAUSED"].includes(session.status)).length ?? 0;
  const trainingDate = currentTraining ? new Date(currentTraining.trainingDate) : null;
  const primaryHref = currentTraining?.status === "RUNNING" ? "/trainer/live" : "/trainer/trainingstag";
  const primaryLabel = currentTraining?.status === "RUNNING" ? "Live Center öffnen" : currentTraining ? "Trainingstag öffnen" : "Trainingstag planen";

  return (
    <main className="vdc-dashboard-page">
      <header className="vdc-page-heading">
        <div>
          <span className="vdc-kicker">Trainerzentrale</span>
          <h1>Dashboard</h1>
          <p>Training planen, Boards steuern und Ergebnisse direkt auswerten.</p>
        </div>
        <Link className="button" href="/trainer/trainingstag">Trainingstag erstellen</Link>
      </header>

      <section className="vdc-dashboard-kpis" aria-label="Kennzahlen">
        <article><span className="vdc-kpi-icon" aria-hidden="true">◎</span><div><small>Aktive Spieler</small><strong>{activePlayers}</strong><p>in der Spielerverwaltung</p></div></article>
        <article><span className="vdc-kpi-icon" aria-hidden="true">▦</span><div><small>Boards verfügbar</small><strong>{availableBoards}<em>/{totalBoards}</em></strong><p>{occupiedBoards} aktuell belegt</p></div></article>
        <article><span className="vdc-kpi-icon" aria-hidden="true">≡</span><div><small>Trainingspläne</small><strong>{planCount}</strong><p>{draftCount} Entwürfe</p></div></article>
        <article><span className="vdc-kpi-icon" aria-hidden="true">↗</span><div><small>Übungen</small><strong>{exerciseCount}</strong><p>{archiveCount} Trainings archiviert</p></div></article>
      </section>

      <section className="vdc-dashboard-main">
        <article className="vdc-next-training">
          <div className="vdc-industrial-lines" aria-hidden="true" />
          <header>
            <div>
              <span className="vdc-kicker">Nächster Trainingstag</span>
              <h2>{currentTraining?.trainingPlan.title ?? "Noch kein Training veröffentlicht"}</h2>
            </div>
            <span className={`vdc-status-badge is-${(currentTraining?.status ?? "PLANNED").toLowerCase()}`}>
              <i aria-hidden="true" />{statusLabel(currentTraining?.status)}
            </span>
          </header>

          {currentTraining ? (
            <>
              <div className="vdc-training-time">
                <strong>{trainingDate?.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</strong>
                <span>{trainingDate?.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
              <div className="vdc-training-facts">
                <div><small>Trainingsziel</small><strong>{currentTraining.trainingPlan.goal}</strong></div>
                <div><small>Spieler</small><strong>{currentTraining.players.length}</strong></div>
                <div><small>Boards</small><strong>{currentTraining.boards.length}</strong></div>
                <div><small>Dauer</small><strong>{currentTraining.trainingPlan.durationMin} Min.</strong></div>
              </div>
              <div className="vdc-training-actions">
                <Link className="button" href={primaryHref}>{primaryLabel}</Link>
                <Link className="button secondary" href="/trainer/live">Boardstatus ansehen</Link>
              </div>
            </>
          ) : (
            <div className="vdc-empty-state compact">
              <strong>Kein veröffentlichter Trainingstag</strong>
              <p>Wähle einen Trainingsplan, Spieler und Boards aus.</p>
              <Link className="button" href="/trainer/trainingstag">Trainingstag planen</Link>
            </div>
          )}
        </article>

        <aside className="vdc-board-overview">
          <header><div><span className="vdc-kicker">Live-Übersicht</span><h2>Boards</h2></div><strong>{runningBoards} aktiv</strong></header>
          <div className="vdc-board-status-list">
            {currentTraining?.boards.map((entry) => {
              const session = currentTraining.sessions.find((item) => item.boardId === entry.boardId);
              const status = session?.status ?? "NOT_STARTED";
              return <div key={entry.boardId}><span className={`vdc-board-dot is-${status.toLowerCase()}`} /><div><strong>{entry.board.name}</strong><small>{statusLabel(status)}</small></div><b>{session?.status === "RUNNING" ? "LIVE" : "–"}</b></div>;
            })}
            {!currentTraining && <div className="vdc-empty-line">Noch keine Boards zugewiesen.</div>}
          </div>
          <Link className="vdc-text-link" href="/trainer/live">Live Center öffnen →</Link>
        </aside>
      </section>

      <section className="vdc-dashboard-section">
        <header className="vdc-section-heading"><div><span className="vdc-kicker">Schnellzugriff</span><h2>Trainer-Werkzeuge</h2></div></header>
        <div className="vdc-action-grid">
          <Link href="/trainer/ai-coach"><span>AI</span><div><strong>AI Coach</strong><p>Stärken, Schwächen und Trends analysieren.</p></div><b>→</b></Link>
          <Link href="/trainer/trainingsplaene"><span>≡</span><div><strong>Trainingsplan</strong><p>Plan erstellen oder Entwurf bearbeiten.</p></div><b>→</b></Link>
          <Link href="/trainer/heimtraining"><span>⌂</span><div><strong>Heimtraining</strong><p>Individuelle Pläne zuweisen.</p></div><b>→</b></Link>
          <Link href="/trainer/uebungen"><span>◎</span><div><strong>Übungskatalog</strong><p>Übungen und Engines verwalten.</p></div><b>→</b></Link>
          <Link href="/trainer/spieler"><span>◉</span><div><strong>Spieler</strong><p>Spielerdaten und Status pflegen.</p></div><b>→</b></Link>
          <Link href="/trainer/boards"><span>▦</span><div><strong>Boards</strong><p>Verfügbarkeit und Belegung prüfen.</p></div><b>→</b></Link>
          <Link href="/trainer/archiv"><span>↗</span><div><strong>Archiv</strong><p>Trainings und Statistiken auswerten.</p></div><b>→</b></Link>
        </div>
      </section>

      <section className="vdc-dashboard-bottom">
        <article className="vdc-activity-panel">
          <header className="vdc-section-heading"><div><span className="vdc-kicker">Aktivität</span><h2>Letzte Ergebnisse</h2></div></header>
          <div className="vdc-result-list">
            {recentResults.map((item) => <div key={item.id}><div><strong>{item.player.displayName}</strong><small>{item.exercise.name}</small></div><time>{new Date(item.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time><b>{item.calculatedScore ?? "–"}</b></div>)}
            {recentResults.length === 0 && <div className="vdc-empty-line">Noch keine Ergebnisse vorhanden.</div>}
          </div>
        </article>
        <article className="vdc-planning-panel">
          <header className="vdc-section-heading"><div><span className="vdc-kicker">Planung</span><h2>Aktueller Stand</h2></div></header>
          <div className="vdc-planning-stats">
            <div><small>Entwürfe</small><strong>{draftCount}</strong><Link href="/trainer/trainingsplaene">Bearbeiten</Link></div>
            <div><small>Aktive Pläne</small><strong>{planCount}</strong><Link href="/trainer/trainingsplaene">Öffnen</Link></div>
            <div><small>Archiv</small><strong>{archiveCount}</strong><Link href="/trainer/archiv">Auswerten</Link></div>
          </div>
        </article>
      </section>
    </main>
  );
}
