import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
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

    const handlers = [...(this.handlers.get(input.name) ?? [])];
    if (handlers.length === 0) {
      logger.debug("Domain event published without listeners", {
        eventId: event.id,
        eventName: event.name,
      });
      return event;
    }

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event as DomainEvent<DomainEventName>)),
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error("Domain event listener failed", result.reason, {
          eventId: event.id,
          eventName: event.name,
          listenerIndex: index,
        });
      }
    });

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
