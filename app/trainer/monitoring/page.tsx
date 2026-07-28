import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { getMonitoringSnapshot, type CheckState } from "@/lib/monitoring/system-health";

export const dynamic = "force-dynamic";

function stateLabel(state: CheckState) {
  if (state === "ok") return "Bereit";
  if (state === "warning") return "Warnung";
  if (state === "error") return "Fehler";
  return "Nicht verfügbar";
}

export default async function MonitoringPage() {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) redirect("/login?error=trainer-session");
  if (trainer.role !== "ADMIN") redirect("/trainer/system");

  const snapshot = await getMonitoringSnapshot();
  const checks = [
    { key: "database", label: "Datenbank", value: snapshot.checks.database.latencyMs ? `${snapshot.checks.database.latencyMs} ms` : stateLabel(snapshot.checks.database.state), check: snapshot.checks.database },
    { key: "events", label: "Event Store", value: `${snapshot.checks.events.pending ?? 0} offen`, check: snapshot.checks.events },
    { key: "jobs", label: "Job Queue", value: `${(snapshot.checks.jobs.pending ?? 0) + (snapshot.checks.jobs.retry ?? 0)} wartend`, check: snapshot.checks.jobs },
    { key: "realtime", label: "Realtime", value: stateLabel(snapshot.checks.realtime.state), check: snapshot.checks.realtime },
  ];

  return (
    <main className="monitoring-page">
      <header className="monitoring-hero">
        <div><span>PHASE 6 · PRODUCTION CONTROL</span><h1>System Monitoring</h1><p>Health, Queue, Events, Realtime und Laufzeitdaten der aktuellen Installation.</p></div>
        <div className={`monitoring-overall is-${snapshot.status}`}><i /><strong>{snapshot.status === "healthy" ? "System bereit" : snapshot.status === "degraded" ? "Eingeschränkt" : "Störung"}</strong><small>{new Date(snapshot.checkedAt).toLocaleTimeString("de-DE")}</small></div>
      </header>

      <section className="monitoring-grid">
        {checks.map((item) => <article className={`monitoring-card is-${item.check.state}`} key={item.key}><header><span>{item.label}</span><b>{stateLabel(item.check.state)}</b></header><strong>{item.value}</strong><p>{item.check.message}</p></article>)}
      </section>

      <section className="monitoring-runtime">
        <article><span>Speicher RSS</span><strong>{snapshot.memory.rssMb} MB</strong><small>Arbeitsspeicher des Prozesses</small></article>
        <article><span>Heap</span><strong>{snapshot.memory.heapUsedMb} / {snapshot.memory.heapTotalMb} MB</strong><small>Verwendet / verfügbar</small></article>
        <article><span>Uptime</span><strong>{Math.floor(snapshot.uptimeSeconds / 60)} Min.</strong><small>Aktuelle Serverinstanz</small></article>
        <article><span>Release</span><strong>{snapshot.commit}</strong><small>{snapshot.environment} · v{snapshot.version}</small></article>
      </section>

      <section className="monitoring-panel">
        <header><div><span>ALERT CENTER</span><h2>Aktive Hinweise</h2></div><strong>{snapshot.alerts.length}</strong></header>
        {snapshot.alerts.length === 0 ? <div className="monitoring-empty">Keine aktiven Systemwarnungen.</div> : snapshot.alerts.map((alert) => <article className={`is-${alert.level}`} key={alert.code}><i /><div><strong>{alert.code}</strong><p>{alert.message}</p></div></article>)}
      </section>

      <section className="monitoring-detail-grid">
        <article><span>Event-Verarbeitung</span><dl><div><dt>Offen</dt><dd>{snapshot.checks.events.pending ?? 0}</dd></div><div><dt>Retry</dt><dd>{snapshot.checks.events.retry ?? 0}</dd></div><div><dt>Dead Letter</dt><dd>{snapshot.checks.events.deadLetter ?? 0}</dd></div></dl></article>
        <article><span>Hintergrundjobs</span><dl><div><dt>Offen</dt><dd>{snapshot.checks.jobs.pending ?? 0}</dd></div><div><dt>Aktiv</dt><dd>{snapshot.checks.jobs.processing ?? 0}</dd></div><div><dt>Retry</dt><dd>{snapshot.checks.jobs.retry ?? 0}</dd></div><div><dt>Dead Letter</dt><dd>{snapshot.checks.jobs.deadLetter ?? 0}</dd></div></dl></article>
      </section>

      <footer className="monitoring-footer"><Link href="/trainer/system">Systeminformationen</Link><Link href="/api/health/deep">Deep Health JSON</Link></footer>
    </main>
  );
}
