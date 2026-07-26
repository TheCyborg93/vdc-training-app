import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const startedAt = Date.now();
  let databaseOnline = false;
  let databaseMessage = "Nicht erreichbar";
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOnline = true;
    databaseMessage = `${Date.now() - startedAt} ms Antwortzeit`;
  } catch {
    databaseMessage = "Verbindung fehlgeschlagen";
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "lokal";
  const deployment = process.env.VERCEL_ENV ?? "development";
  const buildDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeStyle: "short" }).format(new Date());

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div><div className="eyebrow">VDC Training OS</div><h1>Systeminformationen</h1><p>Technischer Status und Releaseinformationen der aktuellen Installation.</p></div>
        <span className={`status ${databaseOnline ? "is-success" : "is-error"}`}>{databaseOnline ? "System bereit" : "Prüfung erforderlich"}</span>
      </section>

      <section className="system-grid">
        <article className="system-card"><small>Version</small><strong>1.0.0 RC</strong><p>Release Candidate</p></article>
        <article className="system-card"><small>Umgebung</small><strong>{deployment}</strong><p>Aktuelle Vercel-Umgebung</p></article>
        <article className="system-card"><small>Commit</small><strong>{commit}</strong><p>Bereitgestellter Git-Stand</p></article>
        <article className="system-card"><small>Next.js</small><strong>15.5</strong><p>Application Framework</p></article>
        <article className="system-card"><small>Prisma</small><strong>6.19</strong><p>Datenbank-Client</p></article>
        <article className="system-card"><small>Datenbank</small><strong>{databaseOnline ? "Online" : "Offline"}</strong><p>{databaseMessage}</p></article>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Release</span><h2>Aktueller Build</h2></div></div>
        <div className="club-panel"><p><strong>Erstellt:</strong> {buildDate}</p><p><strong>Produkt:</strong> Vestischer Dart Club – Training OS</p><p><strong>Status:</strong> Version 1.0 Release Candidate</p></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Änderungsverlauf</span><h2>Changelog</h2></div></div>
        <div className="system-changelog">
          <article><h3>1.0.0 RC</h3><p>Neues Designsystem, Trainerzentrale, Trainingsplan-Workflow, Competition Mode, Ergebnis-Engines, Archiv, Spielerstatistik und Abschlussberichte.</p></article>
          <article><h3>0.9.0</h3><p>Technische Stabilisierung von Authentifizierung, Datenbankanbindung, Trainingsabläufen und Heimtraining.</p></article>
        </div>
      </section>
    </main>
  );
}
