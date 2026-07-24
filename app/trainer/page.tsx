import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TrainerPage() {
  const [activePlayers, availableBoards, exerciseCount, planCount, currentTraining, recentResults] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.board.count({ where: { active: true, available: true } }),
    prisma.exercise.count({ where: { active: true } }),
    prisma.trainingPlan.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.trainingDay.findFirst({ where: { status: { in: ["PUBLISHED", "RUNNING"] } }, include: { trainingPlan: true, boards: { include: { board: true } }, players: true, sessions: true }, orderBy: { trainingDate: "asc" } }),
    prisma.exerciseResult.findMany({ include: { player: true, exercise: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const runningBoards = currentTraining?.sessions.filter((session) => session.status === "RUNNING").length ?? 0;

  return (
    <main className="club-dashboard">
      <section className="club-hero">
        <small>Trainer Dashboard</small>
        <h1>Alles im Blick.<br /><span>Alles unter Kontrolle.</span></h1>
        <p>Spieler, Boards, Trainingspläne und Live-Daten werden direkt aus Supabase geladen.</p>
      </section>

      <section className="club-kpis">
        <article className="club-kpi"><small>Aktive Spieler</small><strong>{activePlayers}</strong><span>in der Spielerverwaltung</span></article>
        <article className="club-kpi"><small>Training heute</small><strong>{currentTraining ? new Date(currentTraining.trainingDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–"}</strong><span>{currentTraining ? currentTraining.trainingPlan.title : "nicht geplant"}</span></article>
        <article className="club-kpi"><small>Boards verfügbar</small><strong>{availableBoards}</strong><span>{runningBoards} aktuell im Training</span></article>
        <article className="club-kpi"><small>Übungen / Pläne</small><strong>{exerciseCount}</strong><span>{planCount} Trainingspläne</span></article>
      </section>

      <section className="club-grid-2">
        <div className="club-panel">
          <div className="club-section-title"><div><small>Heutiger Trainingstag</small><h2>{currentTraining?.trainingPlan.title ?? "Noch nicht veröffentlicht"}</h2></div><Link className="club-action" href="/trainer/trainingstag">Verwalten</Link></div>
          {currentTraining ? <>
            <div className="club-training-card">
              <div className="club-board-art"><span /></div>
              <div className="club-training-info">
                <h3>{currentTraining.trainingPlan.goal}</h3>
                <p>{new Date(currentTraining.trainingDate).toLocaleString("de-DE")}</p>
                <p>{currentTraining.boards.length} Boards · {currentTraining.players.length} Spieler · {currentTraining.trainingPlan.durationMin} Minuten</p>
                <Link href="/trainer/live">Live Center öffnen</Link>
              </div>
            </div>
            <div className="club-section-title" style={{ marginTop: 22 }}><div><small>Board Übersicht</small><h2>Status</h2></div></div>
            <div className="club-board-mini-grid">
              {currentTraining.boards.map((entry) => {
                const session = currentTraining.sessions.find((item) => item.boardId === entry.boardId);
                return <span key={entry.boardId}><b>{entry.board.name}</b><i>{session?.status.replaceAll("_", " ") ?? "WARTET"}</i></span>;
              })}
            </div>
          </> : <div className="club-training-info"><p>Erstelle einen Trainingsplan und veröffentliche anschließend den Trainingstag.</p><Link href="/trainer/trainingstag">Trainingstag erstellen</Link></div>}
        </div>

        <aside className="club-panel">
          <div className="club-section-title"><div><small>Aktivität</small><h2>Letzte Ergebnisse</h2></div></div>
          <div className="club-list">
            {recentResults.map((item) => <article key={item.id}><div><strong>{item.player.displayName}</strong><small style={{ display: "block" }}>{item.exercise.name}</small></div><span>{new Date(item.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span><b>{item.calculatedScore ?? "–"}</b></article>)}
            {recentResults.length === 0 && <p>Noch keine Ergebnisse vorhanden.</p>}
          </div>
        </aside>
      </section>

      <section className="club-panel">
        <div className="club-section-title"><div><small>Schnellzugriff</small><h2>Trainer-Werkzeuge</h2></div></div>
        <div className="module-grid">
          <Link className="module-card" href="/trainer/trainingstag"><span className="module-number">01</span><div><strong>Trainingstag</strong><p>Plan, Boards und Spieler zusammenstellen.</p></div><b>→</b></Link>
          <Link className="module-card" href="/trainer/spieler"><span className="module-number">02</span><div><strong>Spieler</strong><p>Spieler verwalten und Leistungsstufen pflegen.</p></div><b>→</b></Link>
          <Link className="module-card" href="/trainer/uebungen"><span className="module-number">03</span><div><strong>Übungskatalog</strong><p>Übungen und Ergebnistypen bearbeiten.</p></div><b>→</b></Link>
          <Link className="module-card" href="/trainer/trainingsplaene"><span className="module-number">04</span><div><strong>Trainingspläne</strong><p>Neue Pläne automatisch erstellen.</p></div><b>→</b></Link>
        </div>
      </section>
    </main>
  );
}
