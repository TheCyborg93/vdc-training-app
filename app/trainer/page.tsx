import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

type AttendanceCount = { status: string; count: number };

type TrainingDayOverview = {
  id: number;
  status: string;
  trainingDate: Date;
  trainingPlan: { title: string; goal: string; durationMin: number };
  players: { playerId: number }[];
  boards: { boardId: number; board: { name: string } }[];
  assignments: { playerId: number; boardId: number }[];
  sessions: { status: string; _count: { results: number } }[];
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PLANNED: "Geplant",
    PUBLISHED: "Bereit",
    RUNNING: "Live",
    COMPLETED: "Beendet",
    CANCELLED: "Abgesagt",
  };
  return labels[status] ?? status;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Guten Tag";
  return "Guten Abend";
}

async function attendanceSummary(trainingDayId: number | null) {
  if (!trainingDayId) return new Map<string, number>();
  try {
    const rows = await prisma.$queryRaw<AttendanceCount[]>`
      SELECT "status", COUNT(*)::int AS "count"
      FROM "TrainingAttendance"
      WHERE "trainingDayId" = ${trainingDayId}
      GROUP BY "status"
    `;
    return new Map(rows.map((row) => [row.status, Number(row.count)]));
  } catch {
    return new Map<string, number>();
  }
}

function formatDate(value: Date) {
  return value.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function TrainerPage() {
  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const [liveTraining, nextTraining, activePlayers, availableBoards, totalBoards, draftPlans, recentResults, completedTrainings] = await Promise.all([
    prisma.trainingDay.findFirst({
      where: { status: "RUNNING" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        trainingDate: true,
        trainingPlan: { select: { title: true, goal: true, durationMin: true } },
        players: { select: { playerId: true } },
        boards: { select: { boardId: true, board: { select: { name: true } } } },
        assignments: { select: { playerId: true, boardId: true } },
        sessions: { select: { status: true, _count: { select: { results: true } } } },
      },
    }),
    prisma.trainingDay.findFirst({
      where: { status: { in: ["PUBLISHED", "PLANNED"] }, trainingDate: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } },
      orderBy: { trainingDate: "asc" },
      select: {
        id: true,
        status: true,
        trainingDate: true,
        trainingPlan: { select: { title: true, goal: true, durationMin: true } },
        players: { select: { playerId: true } },
        boards: { select: { boardId: true, board: { select: { name: true } } } },
        assignments: { select: { playerId: true, boardId: true } },
        sessions: { select: { status: true, _count: { select: { results: true } } } },
      },
    }),
    prisma.player.count({ where: { active: true } }),
    prisma.board.count({ where: { active: true, available: true } }),
    prisma.board.count({ where: { active: true } }),
    prisma.trainingPlan.count({ where: { status: "DRAFT" } }),
    prisma.exerciseResult.findMany({
      where: { deletedAt: null, createdAt: { gte: twelveWeeksAgo } },
      orderBy: { createdAt: "desc" },
      take: 160,
      select: {
        calculatedScore: true,
        exercise: { select: { name: true } },
        player: { select: { displayName: true } },
        createdAt: true,
      },
    }),
    prisma.trainingDay.count({ where: { status: "COMPLETED", trainingDate: { gte: twelveWeeksAgo } } }),
  ]);

  const training = (liveTraining ?? nextTraining) as TrainingDayOverview | null;
  const attendance = await attendanceSummary(training?.id ?? null);
  const present = (attendance.get("PRESENT") ?? 0) + (attendance.get("LATE") ?? 0);
  const absent = (attendance.get("ABSENT") ?? 0) + (attendance.get("EXCUSED") ?? 0);
  const expected = attendance.get("EXPECTED") ?? Math.max(0, (training?.players.length ?? 0) - present - absent);
  const assignedPlayers = new Set(training?.assignments.map((item) => item.playerId) ?? []).size;
  const openAssignments = Math.max(0, (training?.players.length ?? 0) - assignedPlayers);
  const runningBoards = training?.sessions.filter((session) => session.status === "RUNNING").length ?? 0;
  const pausedBoards = training?.sessions.filter((session) => session.status === "PAUSED").length ?? 0;
  const completedBoards = training?.sessions.filter((session) => session.status === "COMPLETED").length ?? 0;
  const resultCount = training?.sessions.reduce((sum, session) => sum + session._count.results, 0) ?? 0;
  const avgScoreValues = recentResults.map((result) => result.calculatedScore).filter((value): value is number => typeof value === "number");
  const averageScore = avgScoreValues.length ? avgScoreValues.reduce((sum, value) => sum + value, 0) / avgScoreValues.length : null;

  const readinessChecks = training ? [
    { label: "Spieler ausgewählt", done: training.players.length > 0, value: `${training.players.length}` },
    { label: "Boards ausgewählt", done: training.boards.length > 0, value: `${training.boards.length}` },
    { label: "Anwesenheit geprüft", done: expected === 0 && training.players.length > 0, value: expected === 0 ? "Fertig" : `${expected} offen` },
    { label: "Gruppen eingeteilt", done: openAssignments === 0 && training.players.length > 0, value: openAssignments === 0 ? "Fertig" : `${openAssignments} offen` },
  ] : [];
  const readiness = readinessChecks.length ? Math.round((readinessChecks.filter((item) => item.done).length / readinessChecks.length) * 100) : 0;

  const primaryHref = training?.status === "RUNNING" ? "/trainer/live" : training ? "/trainer/live" : "/trainer/trainingstag";
  const primaryLabel = training?.status === "RUNNING" ? "Live Center öffnen" : training ? "Training vorbereiten" : "Trainingstag erstellen";

  const recommendation = !training
    ? { title: "Nächsten Trainingstag planen", text: "Es ist aktuell kein Training veröffentlicht. Lege Plan, Teilnehmer und Boards fest." }
    : training.status === "RUNNING"
      ? pausedBoards > 0
        ? { title: `${pausedBoards} Board${pausedBoards === 1 ? " ist" : "s sind"} pausiert`, text: "Prüfe im Live Center, ob die Gruppen fortsetzen können oder Unterstützung brauchen." }
        : { title: "Training läuft stabil", text: `${runningBoards} Boards sind aktiv. Der Coach-Modus priorisiert auffällige Gruppen automatisch.` }
      : expected > 0
        ? { title: "Check-in noch offen", text: `${expected} Spieler warten noch auf einen Anwesenheitsstatus.` }
        : openAssignments > 0
          ? { title: "Gruppeneinteilung abschließen", text: `${openAssignments} Spieler sind noch keinem Board zugewiesen.` }
          : { title: "Training ist startbereit", text: "Anwesenheit, Boards und Gruppen sind vollständig vorbereitet." };

  return (
    <main className="phase6-dashboard">
      <header className="phase6-dashboard-hero">
        <div>
          <span>TRAINER COCKPIT V2</span>
          <h1>{greeting()}, Trainer.</h1>
          <p>{training ? `${training.trainingPlan.title} · ${training.trainingPlan.goal}` : "Steuere Planung, Check-in und Live-Training aus einer Oberfläche."}</p>
        </div>
        <div className="phase6-dashboard-hero-actions">
          <Link className="is-primary" href={primaryHref}>{primaryLabel}</Link>
          <Link href="/trainer/trainingsplaene">Plan erstellen</Link>
        </div>
      </header>

      <section className="phase6-dashboard-kpis" aria-label="Trainer Kennzahlen">
        <article><span>Aktive Spieler</span><strong>{activePlayers}</strong><small>im Verein verfügbar</small></article>
        <article><span>Boards verfügbar</span><strong>{availableBoards}<em>/{totalBoards}</em></strong><small>für Training freigegeben</small></article>
        <article><span>Trainings 12 Wochen</span><strong>{completedTrainings}</strong><small>abgeschlossene Einheiten</small></article>
        <article><span>Ø Ergebnis</span><strong>{averageScore === null ? "–" : averageScore.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</strong><small>letzte 12 Wochen</small></article>
      </section>

      <section className="phase6-dashboard-main">
        <article className={`phase6-next-training is-${(training?.status ?? "empty").toLowerCase()}`}>
          <header>
            <div><span>{training?.status === "RUNNING" ? "LIVE TRAINING" : "NÄCHSTER TRAININGSTAG"}</span><h2>{training?.trainingPlan.title ?? "Noch kein Training geplant"}</h2></div>
            <em>{training ? statusLabel(training.status) : "Offen"}</em>
          </header>

          {training ? <>
            <div className="phase6-training-time"><strong>{training.trainingDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</strong><span>{formatDate(training.trainingDate)}</span></div>
            <div className="phase6-training-facts">
              <div><span>Ziel</span><strong>{training.trainingPlan.goal}</strong></div>
              <div><span>Dauer</span><strong>{training.trainingPlan.durationMin} Min.</strong></div>
              <div><span>Spieler</span><strong>{training.players.length}</strong></div>
              <div><span>Boards</span><strong>{training.boards.length}</strong></div>
            </div>
            <div className="phase6-training-live-stats">
              <div><span>Vor Ort</span><strong>{present}</strong></div>
              <div><span>Check-in offen</span><strong>{expected}</strong></div>
              <div><span>Aktive Boards</span><strong>{runningBoards}</strong></div>
              <div><span>Ergebnisse</span><strong>{resultCount}</strong></div>
            </div>
            <div className="phase6-training-actions"><Link className="is-primary" href="/trainer/live">{training.status === "RUNNING" ? "Live Center" : "Vorbereitung öffnen"}</Link><Link href="/trainer/trainingstag">Trainingstag bearbeiten</Link></div>
          </> : <div className="phase6-dashboard-empty"><strong>Plane die nächste Vereinseinheit</strong><p>Wähle einen Trainingsplan, Teilnehmer und verfügbare Boards aus.</p><Link href="/trainer/trainingstag">Trainingstag erstellen</Link></div>}
        </article>

        <aside className="phase6-readiness">
          <header><div><span>STARTBEREITSCHAFT</span><h2>{readiness}% vorbereitet</h2></div><strong>{readiness}%</strong></header>
          <div className="phase6-readiness-bar"><i style={{ width: `${readiness}%` }} /></div>
          <div className="phase6-readiness-list">
            {readinessChecks.map((check) => <div className={check.done ? "is-done" : ""} key={check.label}><i>{check.done ? "✓" : "!"}</i><span>{check.label}</span><strong>{check.value}</strong></div>)}
            {!training && <p>Nach Veröffentlichung eines Trainingstags erscheint hier die vollständige Vorbereitung.</p>}
          </div>
          {training && training.status !== "RUNNING" && <Link href="/trainer/live">Check-in & Gruppierung öffnen</Link>}
        </aside>
      </section>

      <section className="phase6-dashboard-tools">
        <header><div><span>SCHNELLZUGRIFF</span><h2>Trainer-Werkzeuge</h2></div><small>{draftPlans} Planentwürfe offen</small></header>
        <div>
          <Link href="/trainer/live"><b>LIVE</b><strong>Live Center</strong><span>Boards, Check-in und Gruppen steuern</span></Link>
          <Link href="/trainer/trainingstag"><b>01</b><strong>Trainingstag</strong><span>Plan, Spieler und Boards festlegen</span></Link>
          <Link href="/trainer/trainingsplaene"><b>02</b><strong>Plan Builder</strong><span>Trainingspläne erstellen und bearbeiten</span></Link>
          <Link href="/trainer/ai-coach"><b>AI</b><strong>Coach Analyse</strong><span>Schwerpunkte und Empfehlungen prüfen</span></Link>
          <Link href="/trainer/statistiken"><b>03</b><strong>Statistiken</strong><span>Spieler- und Vereinsleistung analysieren</span></Link>
          <Link href="/trainer/uebungen"><b>04</b><strong>Übungen</strong><span>Katalog und Ergebnis-Engines verwalten</span></Link>
        </div>
      </section>

      <section className="phase6-dashboard-lower">
        <article className="phase6-coach-recommendation"><span>COACH HINWEIS</span><h2>{recommendation.title}</h2><p>{recommendation.text}</p><Link href={training ? "/trainer/live" : "/trainer/trainingstag"}>Jetzt bearbeiten →</Link></article>
        <article className="phase6-recent-activity"><header><div><span>LETZTE AKTIVITÄT</span><h2>Trainingsergebnisse</h2></div><Link href="/trainer/statistiken">Alle ansehen</Link></header><div>{recentResults.slice(0, 6).map((result, index) => <div key={`${result.createdAt.toISOString()}-${index}`}><i>{result.player.displayName.slice(0, 2).toUpperCase()}</i><span><strong>{result.player.displayName}</strong><small>{result.exercise.name}</small></span><b>{result.calculatedScore === null ? "–" : result.calculatedScore.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</b></div>)}{recentResults.length === 0 && <p>Noch keine Ergebnisse vorhanden.</p>}</div></article>
      </section>
    </main>
  );
}
