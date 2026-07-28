import { eventBus } from "@/lib/events/event-bus";
import { projectDomainEvent } from "@/lib/events/projection-listeners";
import type { DomainEventName } from "@/lib/events/types";
import { logger } from "@/lib/logger";
import { broadcastNotificationRefresh } from "@/lib/realtime/notification-events";
import { broadcastTrainingEvent } from "@/lib/realtime/training-events";

const eventNames: DomainEventName[] = [
  "training.day.created",
  "training.finished",
  "board.paused",
  "board.resumed",
  "board.finished",
  "board.player.changed",
  "board.order.changed",
  "exercise.finished",
  "exercise.changed",
];

const globalForListeners = globalThis as typeof globalThis & {
  vdcCoreEventListenersRegistered?: boolean;
};

export function registerCoreEventListeners() {
  if (globalForListeners.vdcCoreEventListenersRegistered) return;

  for (const name of eventNames) {
    eventBus.subscribe(name, async (event) => {
      logger.info("Domain event handled", {
        eventId: event.id,
        eventName: event.name,
        occurredAt: event.occurredAt,
        source: event.metadata.source,
        actorId: event.metadata.actorId,
        correlationId: event.metadata.correlationId,
        payload: event.payload,
      });
    });

    eventBus.subscribe(name, async (event) => {
      await projectDomainEvent(event);
      await broadcastNotificationRefresh(event);
    });

    eventBus.subscribe(name, async (event) => {
      await broadcastTrainingEvent(event);
    });
  }

  globalForListeners.vdcCoreEventListenersRegistered = true;
}
