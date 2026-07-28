import { Prisma, type DomainEventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DomainEvent, DomainEventName } from "@/lib/events/types";

const MAX_ATTEMPTS = 5;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function persistDomainEvent(event: DomainEvent) {
  return prisma.domainEventRecord.create({
    data: {
      id: event.id,
      name: event.name,
      payloadJson: json(event.payload),
      metadataJson: json(event.metadata),
      occurredAt: new Date(event.occurredAt),
      status: "PENDING",
    },
  });
}

export async function markDomainEventProcessing(eventId: string) {
  return prisma.domainEventRecord.update({
    where: { id: eventId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      nextAttemptAt: null,
      lastError: null,
    },
  });
}

export async function markDomainEventProcessed(eventId: string) {
  return prisma.domainEventRecord.update({
    where: { id: eventId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      nextAttemptAt: null,
      lastError: null,
    },
  });
}

export async function markDomainEventFailed(eventId: string, error: unknown) {
  const record = await prisma.domainEventRecord.findUnique({
    where: { id: eventId },
    select: { attempts: true },
  });
  if (!record) return null;

  const deadLetter = record.attempts >= MAX_ATTEMPTS;
  const delayMinutes = Math.min(60, Math.max(1, 2 ** Math.max(0, record.attempts - 1)));
  return prisma.domainEventRecord.update({
    where: { id: eventId },
    data: {
      status: deadLetter ? "DEAD_LETTER" : "RETRY",
      nextAttemptAt: deadLetter ? null : new Date(Date.now() + delayMinutes * 60_000),
      lastError: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    },
  });
}

export async function findRetryableDomainEvents(limit = 25) {
  return prisma.domainEventRecord.findMany({
    where: {
      status: { in: ["PENDING", "RETRY"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { occurredAt: "asc" }],
    take: Math.min(100, Math.max(1, limit)),
  });
}

export async function recoverStuckDomainEvents(olderThanMinutes = 10) {
  return prisma.domainEventRecord.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) },
    },
    data: {
      status: "RETRY",
      nextAttemptAt: new Date(),
      lastError: "Verarbeitung wurde unterbrochen und automatisch erneut eingeplant.",
    },
  });
}

export function mapStoredDomainEvent(record: {
  id: string;
  name: string;
  payloadJson: Prisma.JsonValue;
  metadataJson: Prisma.JsonValue;
  occurredAt: Date;
}): DomainEvent {
  return {
    id: record.id,
    name: record.name as DomainEventName,
    occurredAt: record.occurredAt.toISOString(),
    payload: record.payloadJson as DomainEvent["payload"],
    metadata: record.metadataJson as DomainEvent["metadata"],
  };
}

export async function getDomainEventStoreSummary() {
  const grouped = await prisma.domainEventRecord.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const summary: Record<DomainEventStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    PROCESSED: 0,
    RETRY: 0,
    DEAD_LETTER: 0,
  };
  grouped.forEach((item) => {
    summary[item.status] = item._count._all;
  });
  return summary;
}
