import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { runPhase6EngineAudit } from "@/lib/phase6/engine-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainer = await getAuthenticatedTrainer();
  if (trainer?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen die Phase-6-Abnahme ausführen." },
      { status: 403 },
    );
  }

  const audit = runPhase6EngineAudit();
  return NextResponse.json(audit, {
    status: audit.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
