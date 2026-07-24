import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const params = await searchParams;
  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { displayName: "asc" } });
  const requestedId = Number(params.player);
  const player = players.find((item) => item.id === requestedId) ?? players[0] ?? null;

  const [results, nextTraining, homePlans] = player
    ? await Promise.all([
        prisma.exerciseResult.findMany({ where: { playerId: player.id }, include: { exercise: true, boardSession: { include: { trainingDay: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
        prisma.trainingDay.findFirst({ where: { status: { in: ["PUBLISHED", "RUNNING"] }, players: { some: { playerId: player.id } } }, include: { trainingPlan: true, boards: true, players: true }, orderBy: { trainingDate: "asc" } }),
        prisma.homeTrainingPlan.count({ where: { playerId: player.id } }),
      ])
    : [[], null, 0];

  const scored = results.map((item) => item.calculatedScore).filter((value): value is number => value !== null);
  const average = scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null;
  const best = scored.length ? Math.max(...scored) : null;
  const checkoutResults = results.filter((item) => item.exercise.resultType === "CHECKOUT");
  const checkoutSuccess = checkoutResults.filter((item) => item.calculatedScore === 1).length;
  const checkoutRate = checkoutResults.length ? (checkoutSuccess / checkoutResults.length) * 100 : null;
  const trainingDays = new Set(results.map((item) => item.boardSession.trainingDay.id)).size;

  return (
    <main className="club-dashboard">
      <section className="club-hero">
        <small>Guten Tag,</small>
        <h1>{player ? player.displayName : "VDC Spieler"}<br /><span>Bereit, dein Game zu pushen?</span></h1>
        <p>Deine persönlichen Trainingsdaten werden direkt aus der Vereinsdatenbank geladen.</p>
        {players.length > 1 && <form method="get" style={{ marginTop: 18 }}><select name="player" defaultValue={player?.id} className="select">{players.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><button className="button" style={{ marginTop: 10 }}>Spieler anzeigen</button></form>}
      </section>

      <section className="club-kpis">
        <article className="club-kpi"><small>Trainingstage</small><strong>{trainingDays}</strong><span>aus der Datenbank</span></article>
        <article className="club-kpi"><small>Durchschnitt</small><strong>{average === null ? "–" : average.toFixed(2)}</strong><span>{scored.length} gewertete Ergebnisse</span></article>
        <article className="club-kpi"><small>Bester Wert</small><strong>{best === null ? "–" : best.toFixed(0)}</strong><span>Persönlicher Rekord</span></article>
        <article className="club-kpi"><small>Checkoutquote</small><strong>{checkoutRate === null ? "–" : `${checkoutRate.toFixed(1)} %`}</strong><span>{checkoutSuccess}/{checkoutResults.length} erfolgreich</span></article>
      </section>

      <section className="club-grid-2">
        <div className="club-panel">
          <div className="club-section-title"><div><small>Dein nächstes Training</small><h2>{nextTraining ? nextTraining.trainingPlan.title : "Noch nicht geplant"}</h2></div></div>
          <div className="club-training-card">
            <div className="club-board-art"><span /></div>
            <div className="club-training-info">
              <h3>{nextTraining ? nextTraining.trainingPlan.goal : "Vereinstraining"}</h3>
              <p>{nextTraining ? new Date(nextTraining.trainingDate).toLocaleString("de-DE") : "Sobald ein Trainer einen Trainingstag veröffentlicht, erscheint er hier."}</p>
              <p>{nextTraining ? `${nextTraining.boards.length} Boards · ${nextTraining.players.length} Spieler · ${nextTraining.trainingPlan.durationMin} Minuten` : `${homePlans} Heimtrainingspläne verfügbar`}</p>
              <Link href={nextTraining ? "/training" : "/heimtraining"}>{nextTraining ? "Details anzeigen" : "Heimtraining öffnen"}</Link>
            </div>
          </div>

          <div className="club-section-title" style={{ marginTop: 24 }}><div><small>Letzte Trainingseinheit</small><h2>Deine Ergebnisse</h2></div></div>
          <div className="club-list">
            {results.slice(0, 5).map((item) => <article key={item.id}><div><strong>{item.exercise.name}</strong><small style={{ display: "block" }}>{new Date(item.createdAt).toLocaleDateString("de-DE")}</small></div><span>{item.exercise.resultType.replaceAll("_", " ")}</span><b>{item.calculatedScore ?? "–"}</b></article>)}
            {results.length === 0 && <p>Noch keine Trainingsergebnisse gespeichert.</p>}
          </div>
        </div>

        <aside className="club-panel">
          <div className="club-section-title"><div><small>Dein Fortschritt</small><h2>Trainingsaktivität</h2></div></div>
          <div className="club-progress-ring" style={{ "--progress": `${Math.min(100, trainingDays * 10)}%` } as React.CSSProperties}><strong>{Math.min(100, trainingDays * 10)}%</strong></div>
          <p style={{ textAlign: "center" }}>Jeder gespeicherte Trainingstag erhöht deinen Fortschritt.</p>
          <Link className="club-action" href="/statistik">Alle Statistiken</Link>
        </aside>
      </section>
    </main>
  );
}
