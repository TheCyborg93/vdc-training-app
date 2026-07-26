import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function numeric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function format(value: number | null, digits = 1) {
  return value === null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export default async function TrainingArchivePage() {
  const days = await prisma.trainingDay.findMany({
    where: { status: "COMPLETED" },
    orderBy: { trainingDate: "desc" },
    include: {
      trainingPlan: { include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } } },
      assignments: { include: { player: true, board: true } },
      sessions: { include: { board: true, results: { where: { deletedAt: null }, include: { player: true, exercise: true }, orderBy: { createdAt: "asc" } } } },
    },
  });

  const allResults = days.flatMap((day) => day.sessions.flatMap((session) => session.results));
  const allScores = allResults.map((result) => numeric(result.calculatedScore)).filter((value): value is number => value !== null);
  const average = allScores.length ? allScores.reduce((sum, value) => sum + value, 0) / allScores.length : null;
  const uniquePlayers = new Set(days.flatMap((day) => day.assignments.map((assignment) => assignment.playerId))).size;
  const totalMinutes = days.reduce((sum, day) => sum + day.trainingPlan.durationMin, 0);

  return <main className="dashboard-page analysis-page">
    <section className="dashboard-heading analysis-heading">
      <div><div className="eyebrow">Analysezentrum</div><h1>Trainingsarchiv</h1><p>Abgeschlossene Trainingstage, Teilnehmer und Leistungsdaten kompakt auswerten.</p></div>
      <div className="analysis-heading-actions"><Link className="button secondary" href="/statistik">Spielerstatistik</Link><Link className="button" href="/trainer/trainingsplaene">Trainingspläne</Link></div>
    </section>

    <section className="analysis-kpis">
      <article><small>Trainingseinheiten</small><strong>{days.length}</strong><span>vollständig abgeschlossen</span></article>
      <article><small>Trainingszeit</small><strong>{totalMinutes}</strong><span>geplante Minuten</span></article>
      <article><small>Aufnahmen</small><strong>{allResults.length}</strong><span>gültig gespeichert</span></article>
      <article><small>Spieler</small><strong>{uniquePlayers}</strong><span>verschiedene Teilnehmer</span></article>
      <article><small>Ø Ergebnis</small><strong>{format(average)}</strong><span>numerische Ergebnisse</span></article>
    </section>

    <section className="analysis-section">
      <div className="section-heading"><div><span className="eyebrow">Historie</span><h2>Abgeschlossene Trainingstage</h2></div><span className="analysis-count">{days.length} Einträge</span></div>
      {days.length === 0 ? <div className="analysis-empty"><strong>Noch keine archivierten Trainings</strong><p>Sobald ein Trainingstag vollständig beendet wurde, erscheint er hier mit seinen Statistiken.</p><Link className="button" href="/trainer/trainingstag">Trainingstag öffnen</Link></div> : <div className="analysis-archive-list">
        {days.map((day) => {
          const results = day.sessions.flatMap((session) => session.results);
          const scores = results.map((result) => numeric(result.calculatedScore)).filter((value): value is number => value !== null);
          const dayAverage = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
          const best = scores.length ? Math.max(...scores) : null;
          const players = [...new Map(day.assignments.map((assignment) => [assignment.player.id, assignment.player])).values()];
          const boards = [...new Map(day.assignments.map((assignment) => [assignment.board.id, assignment.board])).values()];
          const exerciseStats = day.trainingPlan.exercises.map((entry) => ({ name: entry.exercise.name, count: results.filter((result) => result.exerciseId === entry.exerciseId).length }));

          return <article className="analysis-training-card" key={day.id}>
            <header>
              <div><small>{new Date(day.trainingDate).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</small><h2>{day.trainingPlan.title}</h2><p>{day.trainingPlan.goal}</p></div>
              <span className="analysis-status"><i /> Abgeschlossen</span>
            </header>
            <div className="analysis-training-facts">
              <span><small>Dauer</small><strong>{day.trainingPlan.durationMin} Min.</strong></span>
              <span><small>Spieler</small><strong>{players.length}</strong></span>
              <span><small>Boards</small><strong>{boards.length}</strong></span>
              <span><small>Übungen</small><strong>{day.trainingPlan.exercises.length}</strong></span>
              <span><small>Aufnahmen</small><strong>{results.length}</strong></span>
              <span><small>Ø Ergebnis</small><strong>{format(dayAverage)}</strong></span>
              <span><small>Bestwert</small><strong>{best ?? "–"}</strong></span>
            </div>
            <div className="analysis-training-details">
              <section><small>Teilnehmer</small><div className="analysis-chip-list">{players.map((player) => <span key={player.id}>{player.displayName}</span>)}</div></section>
              <section><small>Boards</small><div className="analysis-chip-list">{boards.map((board) => <span key={board.id}>{board.name}</span>)}</div></section>
            </div>
            <div className="analysis-exercise-list">
              {exerciseStats.map((item, index) => <div key={`${item.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.count} Aufnahmen</small></div>)}
            </div>
          </article>;
        })}
      </div>}
    </section>
  </main>;
}
