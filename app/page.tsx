import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const params = await searchParams;
  const players = await prisma.player.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  const requestedId = Number(params.player);
  const player = players.find((item) => item.id === requestedId) ?? players[0] ?? null;

  const [results, nextTraining, homePlans] = player
    ? await Promise.all([
        prisma.exerciseResult.findMany({
          where: { playerId: player.id },
          select: {
            id: true,
            calculatedScore: true,
            createdAt: true,
            exercise: { select: { name: true, resultType: true } },
            boardSession: { select: { trainingDay: { select: { id: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
        prisma.trainingDay.findFirst({
          where: {
            status: { in: ["PUBLISHED", "RUNNING"] },
            players: { some: { playerId: player.id } },
          },
          select: {
            trainingDate: true,
            trainingPlan: { select: { title: true, goal: true, durationMin: true } },
            boards: { select: { boardId: true } },
            players: { select: { playerId: true } },
          },
          orderBy: { trainingDate: "asc" },
        }),
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
  const progress = Math.min(100, trainingDays * 10);

  return (
    <main className="player-v3">
      <section className="player-v3-hero">
        <div className="player-v3-copy">
          <div className="player-v3-kicker">Spielerbereich</div>
          <h1>
            {player?.displayName ?? "VDC Spieler"}
            <span>Bereit für die nächste Aufnahme?</span>
          </h1>
          <p>
            Dein persönlicher Trainingsbereich bündelt nächste Einheiten, Heimtraining und deine zuletzt gespeicherten Ergebnisse.
          </p>
        </div>

        {players.length > 1 ? (
          <form method="get" className="player-v3-switch">
            <label>
              Spielerprofil
              <select name="player" defaultValue={player?.id}>
                {players.map((item) => (
                  <option key={item.id} value={item.id}>{item.displayName}</option>
                ))}
              </select>
            </label>
            <button type="submit">Profil öffnen</button>
          </form>
        ) : (
          <div className="player-v3-switch">
            <div className="player-v3-kicker">Aktives Profil</div>
            <strong>{player?.displayName ?? "Noch kein Spieler"}</strong>
            <Link className="player-v3-action" href="/heimtraining">Heimtraining öffnen</Link>
          </div>
        )}
      </section>

      <section className="player-v3-kpis" aria-label="Persönliche Trainingskennzahlen">
        <article className="player-v3-kpi"><small>Trainingstage</small><strong>{trainingDays}</strong><span>Vereinseinheiten mit Ergebnis</span></article>
        <article className="player-v3-kpi"><small>Durchschnitt</small><strong>{average === null ? "–" : average.toFixed(2)}</strong><span>{scored.length} gewertete Ergebnisse</span></article>
        <article className="player-v3-kpi"><small>Bester Wert</small><strong>{best === null ? "–" : best.toFixed(0)}</strong><span>Persönlicher Bestwert</span></article>
        <article className="player-v3-kpi"><small>Checkoutquote</small><strong>{checkoutRate === null ? "–" : `${checkoutRate.toFixed(1)} %`}</strong><span>{checkoutSuccess} von {checkoutResults.length} erfolgreich</span></article>
      </section>

      <section className="player-v3-grid">
        <div className="player-v3-panel">
          <div className="player-v3-heading">
            <div><small>Nächster Schritt</small><h2>{nextTraining ? "Vereinstraining" : "Heimtraining"}</h2></div>
          </div>

          <article className="player-v3-training">
            <div className="player-v3-board" aria-hidden="true" />
            <div>
              <h3>{nextTraining?.trainingPlan.title ?? `${homePlans} persönliche Pläne verfügbar`}</h3>
              <p>{nextTraining?.trainingPlan.goal ?? "Starte eine persönliche Einheit passend zu deinem Trainingsziel."}</p>
              <p>
                {nextTraining
                  ? `${new Date(nextTraining.trainingDate).toLocaleString("de-DE")} · ${nextTraining.boards.length} Boards · ${nextTraining.players.length} Spieler · ${nextTraining.trainingPlan.durationMin} Minuten`
                  : "Dein Fortschritt und alle Aufnahmen werden automatisch gespeichert."}
              </p>
              <Link className="player-v3-action" href={nextTraining ? "/training" : "/heimtraining"}>
                {nextTraining ? "Trainingstag öffnen" : "Heimtraining starten"}
              </Link>
            </div>
          </article>

          <div className="player-v3-heading" style={{ marginTop: 26 }}>
            <div><small>Aktivität</small><h2>Letzte Ergebnisse</h2></div>
            <Link className="player-v3-action" href="/statistik">Alle Statistiken</Link>
          </div>

          <div className="player-v3-results">
            {results.slice(0, 6).map((item) => (
              <article className="player-v3-result" key={item.id}>
                <div><strong>{item.exercise.name}</strong><small>{new Date(item.createdAt).toLocaleDateString("de-DE")}</small></div>
                <span>{item.exercise.resultType.replaceAll("_", " ")}</span>
                <b>{item.calculatedScore ?? "–"}</b>
              </article>
            ))}
            {results.length === 0 && <div className="home-v3-empty">Noch keine Trainingsergebnisse gespeichert.</div>}
          </div>
        </div>

        <aside className="player-v3-panel">
          <div className="player-v3-heading"><div><small>Trainingsaktivität</small><h2>Dein Fortschritt</h2></div></div>
          <div className="player-v3-progress" style={{ "--progress": `${progress}%` } as CSSProperties}><strong>{progress}%</strong></div>
          <p className="player-v3-progress-copy">
            Jeder abgeschlossene Trainingstag erweitert deine persönliche Datengrundlage und macht kommende Empfehlungen genauer.
          </p>
          <Link className="player-v3-action" href="/heimtraining">Persönlichen Plan öffnen</Link>
        </aside>
      </section>
    </main>
  );
}
