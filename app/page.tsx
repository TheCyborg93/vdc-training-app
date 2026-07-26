import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORE_FOCUS = ["Scoring", "Doppel", "Checkout", "Mental", "Konstanz"];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const weekday = date.getDay() || 7;
  return addDays(date, 1 - weekday);
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function focusName(name: string) {
  const normalized = name.toLowerCase();
  return CORE_FOCUS.find((focus) => normalized.includes(focus.toLowerCase())) ?? null;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const params = await searchParams;
  const players = await prisma.player.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  const requestedId = Number(params.player);
  const player = players.find((item) => item.id === requestedId) ?? players[0] ?? null;

  const today = startOfDay(new Date());
  const activityStart = addDays(today, -55);

  const [clubResults, homeResults, homeSessions, nextTraining, homePlans] = player
    ? await Promise.all([
        prisma.exerciseResult.findMany({
          where: { playerId: player.id, deletedAt: null, createdAt: { gte: activityStart } },
          select: {
            id: true,
            calculatedScore: true,
            createdAt: true,
            exercise: {
              select: {
                name: true,
                resultType: true,
                categories: { select: { category: { select: { name: true } } } },
              },
            },
            boardSession: { select: { trainingDay: { select: { id: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 240,
        }),
        prisma.homeExerciseResult.findMany({
          where: { playerId: player.id, deletedAt: null, createdAt: { gte: activityStart } },
          select: {
            id: true,
            calculatedScore: true,
            createdAt: true,
            exercise: {
              select: {
                name: true,
                resultType: true,
                categories: { select: { category: { select: { name: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 240,
        }),
        prisma.homeTrainingSession.findMany({
          where: { playerId: player.id, status: "COMPLETED", completedAt: { gte: activityStart } },
          select: { id: true, completedAt: true, plan: { select: { goal: true } } },
          orderBy: { completedAt: "desc" },
          take: 80,
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
    : [[], [], [], null, 0];

  const combinedResults = [
    ...clubResults.map((item) => ({ ...item, source: "Verein" as const })),
    ...homeResults.map((item) => ({ ...item, source: "Zuhause" as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const scored = combinedResults.map((item) => item.calculatedScore).filter((value): value is number => value !== null);
  const average = scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null;
  const best = scored.length ? Math.max(...scored) : null;
  const checkoutResults = combinedResults.filter((item) => item.exercise.resultType === "CHECKOUT");
  const checkoutSuccess = checkoutResults.filter((item) => item.calculatedScore === 1).length;
  const checkoutRate = checkoutResults.length ? (checkoutSuccess / checkoutResults.length) * 100 : null;

  const activityDays = new Set<string>();
  combinedResults.forEach((item) => activityDays.add(dayKey(item.createdAt)));
  homeSessions.forEach((item) => { if (item.completedAt) activityDays.add(dayKey(item.completedAt)); });

  const currentWeekStart = startOfWeek(today);
  const currentWeekDays = Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
  const currentWeekCount = currentWeekDays.filter((date) => activityDays.has(dayKey(date))).length;
  const weeklyTarget = 2;
  const weeklyProgress = Math.min(100, Math.round((currentWeekCount / weeklyTarget) * 100));

  const weekRows = Array.from({ length: 4 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 3) * 7);
    const days = Array.from({ length: 7 }, (_, day) => addDays(weekStart, day));
    return {
      label: weekStart.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      count: days.filter((date) => activityDays.has(dayKey(date))).length,
      activeDays: days.map((date) => activityDays.has(dayKey(date))),
    };
  });

  let streak = 0;
  let streakCursor = currentWeekStart;
  const currentWeekHasActivity = currentWeekCount > 0;
  if (!currentWeekHasActivity) streakCursor = addDays(streakCursor, -7);
  while (streak < 52) {
    const hasActivity = Array.from({ length: 7 }, (_, day) => addDays(streakCursor, day)).some((date) => activityDays.has(dayKey(date)));
    if (!hasActivity) break;
    streak += 1;
    streakCursor = addDays(streakCursor, -7);
  }

  const focusCounts = Object.fromEntries(CORE_FOCUS.map((focus) => [focus, 0])) as Record<string, number>;
  combinedResults.forEach((item) => {
    item.exercise.categories.forEach((link) => {
      const focus = focusName(link.category.name);
      if (focus) focusCounts[focus] += 1;
    });
  });
  homeSessions.forEach((item) => {
    const focus = focusName(item.plan.goal);
    if (focus) focusCounts[focus] += 3;
  });
  const recommendedFocus = CORE_FOCUS.reduce((lowest, focus) => focusCounts[focus] < focusCounts[lowest] ? focus : lowest, CORE_FOCUS[0]);
  const missingSessions = Math.max(0, weeklyTarget - currentWeekCount);
  const recommendation = missingSessions > 0
    ? `Dir fehlen diese Woche noch ${missingSessions} ${missingSessions === 1 ? "Einheit" : "Einheiten"}. Starte am besten mit ${recommendedFocus}.`
    : `Wochenziel erreicht. Eine kurze ${recommendedFocus}-Einheit hält deinen Rhythmus stabil.`;

  return (
    <main className="player-v3">
      <section className="player-v3-hero">
        <div className="player-v3-copy">
          <div className="player-v3-kicker">Spielerbereich</div>
          <h1>{player?.displayName ?? "VDC Spieler"}<span>Bereit für die nächste Aufnahme?</span></h1>
          <p>Dein persönlicher Trainingsbereich bündelt Vereinstraining, Heimtraining, Wochenrhythmus und deine zuletzt gespeicherten Ergebnisse.</p>
        </div>

        {players.length > 1 ? (
          <form method="get" className="player-v3-switch">
            <label>Spielerprofil<select name="player" defaultValue={player?.id}>{players.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
            <button type="submit">Profil öffnen</button>
          </form>
        ) : (
          <div className="player-v3-switch"><div className="player-v3-kicker">Aktives Profil</div><strong>{player?.displayName ?? "Noch kein Spieler"}</strong><Link className="player-v3-action" href="/heimtraining">Heimtraining öffnen</Link></div>
        )}
      </section>

      <section className="player-v3-kpis" aria-label="Persönliche Trainingskennzahlen">
        <article className="player-v3-kpi"><small>Aktive Tage</small><strong>{activityDays.size}</strong><span>in den letzten acht Wochen</span></article>
        <article className="player-v3-kpi"><small>Durchschnitt</small><strong>{average === null ? "–" : average.toFixed(2)}</strong><span>{scored.length} gewertete Ergebnisse</span></article>
        <article className="player-v3-kpi"><small>Trainingsserie</small><strong>{streak}</strong><span>{streak === 1 ? "aktive Woche" : "aktive Wochen"} in Folge</span></article>
        <article className="player-v3-kpi"><small>Checkoutquote</small><strong>{checkoutRate === null ? "–" : `${checkoutRate.toFixed(1)} %`}</strong><span>{checkoutSuccess} von {checkoutResults.length} erfolgreich</span></article>
      </section>

      <section className="player-v3-grid">
        <div className="player-v3-panel">
          <div className="player-v3-heading"><div><small>Nächster Schritt</small><h2>{nextTraining ? "Vereinstraining" : "Heimtraining"}</h2></div></div>
          <article className="player-v3-training">
            <div className="player-v3-board" aria-hidden="true" />
            <div>
              <h3>{nextTraining?.trainingPlan.title ?? `${homePlans} persönliche Pläne verfügbar`}</h3>
              <p>{nextTraining?.trainingPlan.goal ?? recommendation}</p>
              <p>{nextTraining ? `${new Date(nextTraining.trainingDate).toLocaleString("de-DE")} · ${nextTraining.boards.length} Boards · ${nextTraining.players.length} Spieler · ${nextTraining.trainingPlan.durationMin} Minuten` : "Dein Fortschritt und alle Aufnahmen werden automatisch gespeichert."}</p>
              <Link className="player-v3-action" href={nextTraining ? "/training" : "/heimtraining"}>{nextTraining ? "Trainingstag öffnen" : "Heimtraining starten"}</Link>
            </div>
          </article>

          <div className="player-v3-heading player-v3-activity-heading"><div><small>Vier-Wochen-Rhythmus</small><h2>Deine Trainingswochen</h2></div><span>{currentWeekCount} / {weeklyTarget} diese Woche</span></div>
          <div className="player-v3-weeks">
            {weekRows.map((week, index) => (
              <article key={week.label} className={index === weekRows.length - 1 ? "is-current" : ""}>
                <div><strong>{week.count}</strong><span>aktive Tage</span></div>
                <div className="player-v3-week-dots">{week.activeDays.map((active, day) => <i key={day} className={active ? "is-active" : ""} />)}</div>
                <small>Woche ab {week.label}</small>
              </article>
            ))}
          </div>

          <div className="player-v3-heading player-v3-results-heading"><div><small>Aktivität</small><h2>Letzte Ergebnisse</h2></div><Link className="player-v3-action" href="/statistik">Alle Statistiken</Link></div>
          <div className="player-v3-results">
            {combinedResults.slice(0, 6).map((item) => (
              <article className="player-v3-result" key={`${item.source}-${item.id}`}>
                <div><strong>{item.exercise.name}</strong><small>{new Date(item.createdAt).toLocaleDateString("de-DE")} · {item.source}</small></div>
                <span>{item.exercise.resultType.replaceAll("_", " ")}</span>
                <b>{item.calculatedScore ?? "–"}</b>
              </article>
            ))}
            {combinedResults.length === 0 && <div className="home-v3-empty">Noch keine Trainingsergebnisse gespeichert.</div>}
          </div>
        </div>

        <aside className="player-v3-side">
          <section className="player-v3-panel player-v3-week-goal">
            <div className="player-v3-heading"><div><small>Wochenziel</small><h2>2× trainieren</h2></div></div>
            <div className="player-v3-progress" style={{ "--progress": `${weeklyProgress}%` } as React.CSSProperties}><strong>{currentWeekCount}/{weeklyTarget}</strong></div>
            <p className="player-v3-progress-copy">{currentWeekCount >= weeklyTarget ? "Wochenziel erreicht. Stark – halte den Rhythmus bis Sonntag stabil." : `Noch ${missingSessions} ${missingSessions === 1 ? "Einheit" : "Einheiten"} bis zum Wochenziel.`}</p>
            <Link className="player-v3-action" href="/heimtraining">Einheit starten</Link>
          </section>

          <section className="player-v3-panel player-v3-recommendation">
            <small>Persönliche Empfehlung</small>
            <h2>{recommendedFocus}</h2>
            <p>{recommendation}</p>
            <div className="player-v3-focus-bars">{CORE_FOCUS.map((focus) => <div key={focus}><span>{focus}</span><i><b style={{ width: `${Math.min(100, focusCounts[focus] * 8)}%` }} /></i><strong>{focusCounts[focus]}</strong></div>)}</div>
            <Link className="player-v3-action" href="/heimtraining">Passenden Plan wählen</Link>
          </section>
        </aside>
      </section>
    </main>
  );
}
