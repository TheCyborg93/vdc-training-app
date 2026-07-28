import { prisma } from "@/lib/prisma";

export type CheckState = "ok" | "warning" | "error" | "unavailable";

export type SystemCheck = {
  state: CheckState;
  latencyMs?: number;
  message: string;
};

export type MonitoringSnapshot = {
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  version: string;
  commit: string;
  environment: string;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  checks: {
    database: SystemCheck;
    events: SystemCheck & { pending?: number; retry?: number; deadLetter?: number };
    jobs: SystemCheck & { pending?: number; processing?: number; retry?: number; deadLetter?: number };
    realtime: SystemCheck;
  };
  alerts: Array<{ level: "warning" | "error"; code: string; message: string }>;
};

async function timedCheck(action: () => Promise<unknown>) {
  const started = performance.now();
  await action();
  return Math.round(performance.now() - started);
}

function numberValue(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  let database: MonitoringSnapshot["checks"]["database"];
  let events: MonitoringSnapshot["checks"]["events"];
  let jobs: MonitoringSnapshot["checks"]["jobs"];

  try {
    const latencyMs = await timedCheck(() => prisma.$queryRaw`SELECT 1`);
    database = {
      state: latencyMs > 500 ? "warning" : "ok",
      latencyMs,
      message: latencyMs > 500 ? "Datenbank antwortet langsam." : "Datenbank verbunden.",
    };
  } catch {
    database = { state: "error", message: "Datenbank nicht erreichbar." };
  }

  try {
    const latencyMs = await timedCheck(async () => {
      await prisma.$queryRaw`SELECT 1 FROM "DomainEventRecord" LIMIT 1`;
    });
    const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT "status", COUNT(*) AS "count"
      FROM "DomainEventRecord"
      WHERE "status" IN ('PENDING', 'RETRY', 'DEAD_LETTER')
      GROUP BY "status"
    `;
    const counts = Object.fromEntries(rows.map((row) => [row.status, numberValue(row.count)]));
    const deadLetter = counts.DEAD_LETTER ?? 0;
    const retry = counts.RETRY ?? 0;
    events = {
      state: deadLetter > 0 ? "error" : retry > 10 ? "warning" : "ok",
      latencyMs,
      message: deadLetter > 0 ? `${deadLetter} Event(s) im Dead-Letter-Status.` : "Event Store betriebsbereit.",
      pending: counts.PENDING ?? 0,
      retry,
      deadLetter,
    };
  } catch {
    events = { state: "unavailable", message: "Event Store noch nicht verfügbar oder Migration fehlt." };
  }

  try {
    const latencyMs = await timedCheck(async () => {
      await prisma.$queryRaw`SELECT 1 FROM "BackgroundJob" LIMIT 1`;
    });
    const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT "status", COUNT(*) AS "count"
      FROM "BackgroundJob"
      WHERE "status" IN ('PENDING', 'PROCESSING', 'RETRY', 'DEAD_LETTER')
      GROUP BY "status"
    `;
    const counts = Object.fromEntries(rows.map((row) => [row.status, numberValue(row.count)]));
    const queued = (counts.PENDING ?? 0) + (counts.RETRY ?? 0);
    const deadLetter = counts.DEAD_LETTER ?? 0;
    jobs = {
      state: deadLetter > 0 ? "error" : queued > 100 ? "warning" : "ok",
      latencyMs,
      message: deadLetter > 0 ? `${deadLetter} Job(s) im Dead-Letter-Status.` : `${queued} Job(s) warten.`,
      pending: counts.PENDING ?? 0,
      processing: counts.PROCESSING ?? 0,
      retry: counts.RETRY ?? 0,
      deadLetter,
    };
  } catch {
    jobs = { state: "unavailable", message: "Job Queue noch nicht verfügbar oder Migration fehlt." };
  }

  const realtimeConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  const realtime: SystemCheck = realtimeConfigured
    ? { state: "ok", message: "Supabase Realtime ist konfiguriert." }
    : { state: "warning", message: "Realtime-Konfiguration ist unvollständig." };

  const memory = process.memoryUsage();
  const alerts: MonitoringSnapshot["alerts"] = [];
  if (database.state === "error") alerts.push({ level: "error", code: "DATABASE_OFFLINE", message: database.message });
  if (database.latencyMs && database.latencyMs > 500) alerts.push({ level: "warning", code: "DATABASE_SLOW", message: `Datenbank benötigt ${database.latencyMs} ms.` });
  if ((events.deadLetter ?? 0) > 0) alerts.push({ level: "error", code: "EVENT_DEAD_LETTER", message: events.message });
  if ((jobs.deadLetter ?? 0) > 0) alerts.push({ level: "error", code: "JOB_DEAD_LETTER", message: jobs.message });
  if ((jobs.pending ?? 0) + (jobs.retry ?? 0) > 100) alerts.push({ level: "warning", code: "QUEUE_BACKLOG", message: "Mehr als 100 Jobs warten auf Verarbeitung." });
  if (realtime.state !== "ok") alerts.push({ level: "warning", code: "REALTIME_CONFIG", message: realtime.message });

  const states = [database.state, events.state, jobs.state, realtime.state];
  const status = states.includes("error") ? "unhealthy" : states.includes("warning") || states.includes("unavailable") ? "degraded" : "healthy";

  return {
    status,
    checkedAt: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.2.0",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    },
    checks: { database, events, jobs, realtime },
    alerts,
  };
}
