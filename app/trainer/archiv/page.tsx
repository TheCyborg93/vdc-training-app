import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function number(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async function TrainingArchivePage() {
  const days = await prisma.trainingDay.findMany({
    where: { status: "COMPLETED" },
    orderBy: { trainingDate: "desc" },
    include: {
      trainingPlan: { include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } } },
      assignments: { include: { player: true, board: true } },
      sessions: {
        include: {
          board: true,
          results: {
            where: { deletedAt: null },
            include: { player: true, exercise: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const totalResults = days.reduce((sum, day) => sum + day.sessions.reduce((sessionSum, session) => sessionSum + session.results.length, 0), 0);
  const allScores = days.flatMap((day) => day.sessions.flatMap((session) => session.results.map((result) => number(result.calculatedScore)).filter((value): value is number => value !== null)));
  const average = allScores.length ? allScores.reduce((sum, value) => sum + value, 0) / allScores.length : null;
  const uniquePlayers = new Set(days.flatMap((day) => day.assignments.map((assignment) => assignment.playerId))).size;

  return <main className="dashboard-page">
    <section className="dashboard-heading">
      <div><div className="eyebrow">Trainerbereich</div><h1>Trainingsarchiv</h1><p>Abgeschlossene Trainingstage und ihre gespeicherten Leistungsdaten.</p></div>
      <Link className="button secondary" href="/trainer/trainingsplaene">Zu den Trainingsplänen</Link>
    </section>

    <section className="club-kpis">
      <article className="club-kpi"><small>Archivierte Trainings</small><strong>{days.length}</strong><span>vollständig beendet</span></article>
      <article className="club-kpi"><small>Gespeicherte Aufnahmen</small><strong>{totalResults}</strong><span>ohne zurückgenommene Ergebnisse</span></article>
      <article className="club-kpi"><small>Teilnehmende Spieler</small><strong>{uniquePlayers}</strong><span>verschiedene Spieler</span></article>
      <article className="club-kpi"><small>Ø Ergebniswert</small><strong>{average === null ? "–" : average.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</strong><span>über numerische Ergebnisse</span></article>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">Historie</span><h2>Abgeschlossene Trainingstage</h2></div></div>
      <div className="archive-training-list">
        {days.length === 0 && <div className="card"><p>Noch kein Trainingstag wurde vollständig beendet.</p></div>}
        {days.map((day) => {
          const results = day.sessions.flatMap((session) => session.results);
          const scores = results.map((result) => number(result.calculatedScore)).filter((value): value is number => value !== null);
          const dayAverage = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
          const best = scores.length ? Math.max(...scores) : null;
          const players = [...new Map(day.assignments.map((assignment) => [assignment.player.id, assignment.player])).values()];
          const exerciseStats = day.trainingPlan.exercises.map((planExercise) => {
            const exerciseResults = results.filter((result) => result.exerciseId === planExercise.exerciseId);
            return { name: planExercise.exercise.name, count: exerciseResults.length };
          });

          return <article className="club-panel archive-training-card" key={day.id}>
            <div className="club-section-title"><div><small>{new Date(day.trainingDate).toLocaleString("de-DE")}</small><h2>{day.trainingPlan.title}</h2></div><span className="status">Archiviert</span></div>
            <p>{day.trainingPlan.goal} · {day.trainingPlan.durationMin} Minuten · {day.sessions.length} Boards · {players.length} Spieler</p>
            <div className="archive-stat-grid">
              <div><small>Aufnahmen</small><strong>{results.length}</strong></div>
              <div><small>Ø Ergebnis</small><strong>{dayAverage === null ? "–" : dayAverage.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</strong></div>
              <div><small>Bestwert</small><strong>{best ?? "–"}</strong></div>
              <div><small>Übungen</small><strong>{day.trainingPlan.exercises.length}</strong></div>
            </div>
            <div className="archive-detail-grid">
              <div><small>Teilnehmer</small><p>{players.map((player) => player.displayName).join(", ") || "Keine Spieler"}</p></div>
              <div><small>Übungsdaten</small><p>{exerciseStats.map((item) => `${item.name}: ${item.count} Aufnahmen`).join(" · ")}</p></div>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
