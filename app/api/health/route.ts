import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "lhr1";

const HEALTH_TTL_MS = 30_000;
type HealthSnapshot = { ok: boolean; database: "connected" | "unavailable"; latencyMs: number; checkedAt: string };
const globalHealth = globalThis as unknown as { vdcHealth?: { expiresAt: number; snapshot: HealthSnapshot } };

export async function GET() {
  const now = Date.now();
  const cached = globalHealth.vdcHealth;

  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.snapshot, {
      status: cached.snapshot.ok ? 200 : 503,
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30", "X-VDC-Health": "cache" },
    });
  }

  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const snapshot: HealthSnapshot = {
      ok: true,
      database: "connected",
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
    globalHealth.vdcHealth = { expiresAt: now + HEALTH_TTL_MS, snapshot };
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30", "X-VDC-Health": "database" },
    });
  } catch (error) {
    console.error("Health check failed", error);
    const snapshot: HealthSnapshot = {
      ok: false,
      database: "unavailable",
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
    globalHealth.vdcHealth = { expiresAt: now + 5_000, snapshot };
    return NextResponse.json(snapshot, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-VDC-Health": "database" },
    });
  }
}
