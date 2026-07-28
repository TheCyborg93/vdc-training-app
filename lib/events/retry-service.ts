import { eventBus } from "@/lib/events/event-bus";
import {
  findRetryableDomainEvents,
  getDomainEventStoreSummary,
  mapStoredDomainEvent,
  recoverStuckDomainEvents,
} from "@/lib/events/event-store-repository";
import { registerCoreEventListeners } from "@/lib/events/register-core-listeners";
import { logger } from "@/lib/logger";

export async function processRetryableDomainEvents(limit = 25) {
  registerCoreEventListeners();
  const recovered = await recoverStuckDomainEvents();
  const records = await findRetryableDomainEvents(limit);
  const results = [] as Array<{ eventId: string; eventName: string; processed: boolean }>;

  for (const record of records) {
    const event = mapStoredDomainEvent(record);
    const result = await eventBus.processStored(event);
    results.push({ eventId: event.id, eventName: event.name, processed: result.processed });
  }

  const processed = results.filter((item) => item.processed).length;
  const failed = results.length - processed;
  logger.info("Domain event retry batch completed", {
    requestedLimit: limit,
    recoveredStuckEvents: recovered.count,
    selected: records.length,
    processed,
    failed,
  });

  return {
    recoveredStuckEvents: recovered.count,
    selected: records.length,
    processed,
    failed,
    results,
    summary: await getDomainEventStoreSummary(),
  };
}

export async function getDomainEventHealth() {
  return getDomainEventStoreSummary();
}
