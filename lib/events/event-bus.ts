import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import {
  markDomainEventFailed,
  markDomainEventProcessed,
  markDomainEventProcessing,
  persistDomainEvent,
} from "@/lib/events/event-store-repository";
import type {
  DomainEvent,
  DomainEventHandler,
  DomainEventMap,
  DomainEventName,
} from "@/lib/events/types";

type HandlerRegistry = Map<DomainEventName, Set<DomainEventHandler<DomainEventName>>>;

class EventBus {
  private readonly handlers: HandlerRegistry = new Map();

  subscribe<TName extends DomainEventName>(
    name: TName,
    handler: DomainEventHandler<TName>,
  ) {
    const registered = this.handlers.get(name) ?? new Set();
    registered.add(handler as DomainEventHandler<DomainEventName>);
    this.handlers.set(name, registered);

    return () => {
      registered.delete(handler as DomainEventHandler<DomainEventName>);
      if (registered.size === 0) this.handlers.delete(name);
    };
  }

  private async dispatch(event: DomainEvent) {
    const handlers = [...(this.handlers.get(event.name) ?? [])];
    if (handlers.length === 0) {
      logger.debug("Domain event published without listeners", {
        eventId: event.id,
        eventName: event.name,
      });
      return;
    }

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event as DomainEvent<DomainEventName>)),
    );
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter((entry): entry is { result: PromiseRejectedResult; index: number } => entry.result.status === "rejected");

    failures.forEach(({ result, index }) => {
      logger.error("Domain event listener failed", result.reason, {
        eventId: event.id,
        eventName: event.name,
        listenerIndex: index,
      });
    });

    if (failures.length > 0) {
      throw new AggregateError(
        failures.map(({ result }) => result.reason),
        `${failures.length} Listener für ${event.name} fehlgeschlagen.`,
      );
    }
  }

  async processStored(event: DomainEvent) {
    try {
      await markDomainEventProcessing(event.id);
      await this.dispatch(event);
      await markDomainEventProcessed(event.id);
      return { processed: true as const };
    } catch (error) {
      try {
        await markDomainEventFailed(event.id, error);
      } catch (storeError) {
        logger.error("Domain event failure state could not be stored", storeError, {
          eventId: event.id,
          eventName: event.name,
        });
      }
      return { processed: false as const, error };
    }
  }

  async publish<TName extends DomainEventName>(input: {
    name: TName;
    payload: DomainEventMap[TName];
    metadata: DomainEvent<TName>["metadata"];
  }): Promise<DomainEvent<TName>> {
    const event: DomainEvent<TName> = {
      id: randomUUID(),
      name: input.name,
      occurredAt: new Date().toISOString(),
      payload: input.payload,
      metadata: input.metadata,
    };

    let persisted = false;
    try {
      await persistDomainEvent(event as DomainEvent);
      persisted = true;
    } catch (error) {
      logger.error("Domain event could not be persisted", error, {
        eventId: event.id,
        eventName: event.name,
      });
    }

    if (persisted) {
      await this.processStored(event as DomainEvent);
    } else {
      try {
        await this.dispatch(event as DomainEvent);
      } catch (error) {
        logger.error("Non-persisted domain event processing failed", error, {
          eventId: event.id,
          eventName: event.name,
        });
      }
    }

    return event;
  }
}

const globalForEvents = globalThis as typeof globalThis & {
  vdcEventBus?: EventBus;
};

export const eventBus = globalForEvents.vdcEventBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.vdcEventBus = eventBus;
}
