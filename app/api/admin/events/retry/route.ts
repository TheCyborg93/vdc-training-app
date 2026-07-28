import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { getDomainEventHealth, processRetryableDomainEvents } from "@/lib/events/retry-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer || trainer.role !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren dürfen den Event Store einsehen." }, { status: 403 });
  }

  try {
    return NextResponse.json({ summary: await getDomainEventHealth() });
  } catch (error) {
    logger.error("Domain event health could not be loaded", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Event-Status konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer || trainer.role !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren dürfen Events erneut verarbeiten." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limitValue = Number((body as { limit?: unknown }).limit ?? 25);
    const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 25;
    const result = await processRetryableDomainEvents(limit);
    logger.info("Domain event retry triggered manually", {
      trainerId: trainer.id,
      selected: result.selected,
      processed: result.processed,
      failed: result.failed,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Domain event retry failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Events konnten nicht erneut verarbeitet werden." }, { status: 500 });
  }
}
