import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TrainingCountdown from "@/components/dashboard/training-countdown";

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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Guten Tag";
  return "Guten Abend";
}

export default async function TrainerPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    activePlayers,
    availableBoards,
    totalBoards,
    exerciseCount,
    planCount,
    draftCount,
    archiveCount,
    completedThisMonth,
    completedThisYear,
    currentTraining,
    recentResults,
  ] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.board.count({ where: { active: true, available: true } }),
    prisma.board.count({ where: { active: true } }),
    prisma.exercise.count({ where: { active: true } }),
    prisma.trainingPlan.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.trainingPlan.count({ where: { status: "DRAFT" } }),
    prisma.trainingDay.count({ where: { status: "COMPLETED" } }),
    prisma.trainingDay.count({ where: { status: "COMPLETED", trainingDate: { gte: monthStart } } }),
    prisma.trainingDay.count({ where: { status: "COMPLETED", trainingDate: { gte: yearStart } } }),
    prisma.trainingDay.findFirst({
      where: { status: { in: ["PUBLISHED", "RUNNING"] } },
      select: {
        id: true,
        status: true,
        trainingDate: true,
        trainingPlan: {
          select: {
            title: true,
            goal: true,
            durationMin: true,
            exercises: {
              select: {
                exerciseId: true,
                exercise: { select: { name: true } },
              },
            },
          },
        },
        boards: { select: { boardId: true, board: { select: { name: true } } } },
        players: { select: { playerId: true } },
        sessions: {
          select: {
            boardId: true,
            status: true,
            currentExerciseId: true,
          },
        },
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
      take: 8,
    }),
  ]);

  const runningBoards = currentTraining?.sessions.filter((session) => session.status === "RUNNING").length ?? 0;
  const occupiedBoards = currentTraining?.sessions.filter((session) => ["RUNNING", "PAUSED"].includes(session.status)).length ?? 0;
  const completedBoards = currentTraining?.sessions.filter((session) => session.status === "COMPLETED").length ?? 0;
  const trainingDate = currentTraining ? new Date(currentTraining.trainingDate) : null;
  const primaryHref = currentTraining?.status === "RUNNING" ? "/trainer/live" : "/trainer/trainingstag";
  const primaryLabel = currentTraining?.status === "RUNNING" ? "Live Center öffnen" : currentTraining ? "Trainingstag öffnen" : "Trainingstag planen";
  const boardUtilization = totalBoards > 0 ? Math.round((occupiedBoards / totalBoards) * 100) : 0;
  const exerciseNames = new Map(
    currentTraining?.trainingPlan.exercises.map((item) => [item.exerciseId, item.exercise.name]) ?? [],
  );

  return (
    <main className="vdc-dashboard-page vdc-dashboard-v3">
      <header className="vdc-v3-hero">
        <div className="vdc-v3-hero-copy">
          <span className="vdc-kicker">VDC Training OS</span>
          <h1>{greeting()}, Trainer.</h1>
          <p>
            {currentTraining
              ? `${currentTraining.players.length} Spieler und ${currentTraining.boards.length} Boards sind für den nächsten Trainingstag eingeplant.`
              : "Plane den nächsten Trainingstag und behalte Spieler, Boards und Leistung im Blick."}
          </p>
          <div className="vdc-v3-hero-actions">
            <Link className="button" href={primaryHref}>{primaryLabel}</Link>
            <Link className="button secondary" href="/trainer/trainingsplaene">Trainingsplan erstellen</Link>
          </div>
        </div>

        <div className="vdc-v3-countdown-card">
          <small>{currentTraining?.status === "RUNNING" ? "Training läuft" : "Bis Trainingsbeginn"}</small>
          <TrainingCountdown target={trainingDate?.toISOString() ?? null} />
          <span>
            {trainingDate
              ? trainingDate.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })
              : "Noch kein Termin veröffentlicht"}
          </span>
        </div>
      </header>

      <section className="vdc-v3-kpi-grid" aria-label="Vereinskennzahlen">
        <article>
          <span className="vdc-v3-kpi-symbol">◎</span>
          <div><small>Aktive Spieler</small><strong>{activePlayers}</strong><p>für das Training verfügbar</p></div>
        </article>
        <article>
          <span className="vdc-v3-kpi-symbol">▦</span>
          <div><small>Boards frei</small><strong>{availableBoards}<em>/{totalBoards}</em></strong><p>{boardUtilization}% aktuell belegt</p></div>
        </article>
        <article>
          <span className="vdc-v3-kpi-symbol">↗</span>
          <div><small>Trainingstage {now.getFullYear()}</small><strong>{completedThisYear}</strong><p>{completedThisMonth} in diesem Monat</p></div>
        </article>
        <article>
          <span className="vdc-v3-kpi-symbol">≡</span>
          <div><small>Übungen</small><strong>{exerciseCount}</strong><p>{planCount} aktive Trainingspläne</p></div>
        </article>
      </section>

      <section className="vdc-v3-command-grid">
        <article className="vdc-v3-training-card">
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
              <div className="vdc-v3-training-date">
                <strong>{trainingDate?.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</strong>
                <span>{trainingDate?.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
              <div className="vdc-v3-training-facts">
                <div><small>Ziel</small><strong>{currentTraining.trainingPlan.goal}</strong></div>
                <div><small>Spieler</small><strong>{currentTraining.players.length}</strong></div>
                <div><small>Boards</small><strong>{currentTraining.boards.length}</strong></div>
                <div><small>Dauer</small><strong>{currentTraining.trainingPlan.durationMin} Min.</strong></div>
              </div>
              <div className="vdc-v3-training-actions">
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

        <aside className="vdc-v3-board-wall">
          <header>
            <div><span className="vdc-kicker">Live Monitor</span><h2>Board Wall</h2></div>
            <strong>{runningBoards} live</strong>
          </header>
          <div className="vdc-v3-board-list">
            {currentTraining?.boards.map((entry) => {
              const session = currentTraining.sessions.find((item) => item.boardId === entry.boardId);
              const status = session?.status ?? "NOT_STARTED";
              const currentExerciseName = session?.currentExerciseId
                ? exerciseNames.get(session.currentExerciseId)
                : undefined;
              return (
                <div key={entry.boardId} className={`is-${status.toLowerCase()}`}>
                  <span className={`vdc-board-dot is-${status.toLowerCase()}`} />
                  <div>
                    <strong>{entry.board.name}</strong>
                    <small>{currentExerciseName ?? statusLabel(status)}</small>
                  </div>
                  <b>{status === "RUNNING" ? "LIVE" : statusLabel(status)}</b>
                </div>
              );
            })}
            {!currentTraining && <div className="vdc-empty-line">Noch keine Boards zugewiesen.</div>}
          </div>
          <div className="vdc-v3-board-summary">
            <span>{occupiedBoards} belegt</span>
            <span>{completedBoards} abgeschlossen</span>
          </div>
          <Link className="vdc-text-link" href="/trainer/live">Live Center öffnen →</Link>
        </aside>
      </section>

      <section className="vdc-v3-section">
        <header className="vdc-section-heading">
          <div><span className="vdc-kicker">Schnellzugriff</span><h2>Trainer-Werkzeuge</h2></div>
        </header>
        <div className="vdc-v3-action-grid">
          <Link href="/trainer/trainingstag"><span>+</span><div><strong>Training veröffentlichen</strong><p>Spieler und Boards einem Plan zuweisen.</p></div><b>→</b></Link>
          <Link href="/trainer/trainingsplaene"><span>≡</span><div><strong>Trainingsplan</strong><p>Plan erstellen oder Entwurf bearbeiten.</p></div><b>→</b></Link>
          <Link href="/trainer/heimtraining"><span>⌂</span><div><strong>Heimtraining</strong><p>Individuelle Pläne für Spieler erstellen.</p></div><b>→</b></Link>
          <Link href="/trainer/ai-coach"><span>AI</span><div><strong>AI Coach</strong><p>Trends und Empfehlungen auswerten.</p></div><b>→</b></Link>
          <Link href="/trainer/statistiken"><span>↗</span><div><strong>Statistiken V2</strong><p>Form, Aktivität und Leistung analysieren.</p></div><b>→</b></Link>
          <Link href="/trainer/uebungen"><span>◎</span><div><strong>Übungskatalog</strong><p>Übungen und Engines verwalten.</p></div><b>→</b></Link>
          <Link href="/trainer/spieler"><span>◉</span><div><strong>Spieler</strong><p>Profile und Aktivstatus verwalten.</p></div><b>→</b></Link>
          <Link href="/trainer/archiv"><span>□</span><div><strong>Trainingsarchiv</strong><p>{archiveCount} abgeschlossene Trainings auswerten.</p></div><b>→</b></Link>
        </div>
      </section>

      <section className="vdc-v3-insights-grid">
        <article className="vdc-v3-coach-card">
          <header><div><span className="vdc-kicker">Coach Briefing</span><h2>Aktueller Fokus</h2></div><span>AI</span></header>
          <strong>{recentResults.length >= 5 ? "Genügend neue Daten für eine aktuelle Analyse." : "Weitere Trainingsergebnisse sammeln."}</strong>
          <p>
            {recentResults.length >= 5
              ? "Öffne den AI Coach, um Stärken, Schwächen und die nächste sinnvolle Trainingsausrichtung zu prüfen."
              : "Mit jedem gespeicherten Ergebnis werden Spielerprofile und Empfehlungen belastbarer."}
          </p>
          <Link className="button secondary" href="/trainer/ai-coach">Coach öffnen</Link>
        </article>

        <article className="vdc-v3-activity-card">
          <header className="vdc-section-heading"><div><span className="vdc-kicker">Aktivität</span><h2>Letzte Ergebnisse</h2></div></header>
          <div className="vdc-result-list">
            {recentResults.slice(0, 6).map((item) => (
              <div key={item.id}>
                <div><strong>{item.player.displayName}</strong><small>{item.exercise.name}</small></div>
                <time>{new Date(item.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                <b>{item.calculatedScore ?? "–"}</b>
              </div>
            ))}
            {recentResults.length === 0 && <div className="vdc-empty-line">Noch keine Ergebnisse vorhanden.</div>}
          </div>
        </article>

        <article className="vdc-v3-planning-card">
          <header className="vdc-section-heading"><div><span className="vdc-kicker">Planung</span><h2>Arbeitsstand</h2></div></header>
          <div className="vdc-v3-planning-list">
            <div><span>Entwürfe</span><strong>{draftCount}</strong><Link href="/trainer/trainingsplaene">Bearbeiten</Link></div>
            <div><span>Aktive Pläne</span><strong>{planCount}</strong><Link href="/trainer/trainingsplaene">Öffnen</Link></div>
            <div><span>Archiv</span><strong>{archiveCount}</strong><Link href="/trainer/archiv">Auswerten</Link></div>
          </div>
        </article>
      </section>
    </main>
  );
}
