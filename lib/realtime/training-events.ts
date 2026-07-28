import { createClient } from "@supabase/supabase-js";
import type { DomainEvent, DomainEventName } from "@/lib/events/types";
import { logger } from "@/lib/logger";

export type TrainingRealtimeMessage = {
  eventId: string;
  eventName: DomainEventName;
  occurredAt: string;
  trainingDayId: number;
  payload: DomainEvent["payload"];
};

function getTrainingDayId(event: DomainEvent): number | null {
  const payload = event.payload as Record<string, unknown>;
  const value = Number(payload.trainingDayId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function broadcastTrainingEvent(event: DomainEvent<DomainEventName>) {
  const trainingDayId = getTrainingDayId(event);
  if (!trainingDayId) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    logger.debug("Realtime broadcast skipped because Supabase environment is incomplete", {
      eventId: event.id,
      eventName: event.name,
      trainingDayId,
    });
    return;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const channel = client.channel(`training:${trainingDayId}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime channel subscription timed out.")), 4_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel status: ${status}`));
        }
      });
    });

    const message: TrainingRealtimeMessage = {
      eventId: event.id,
      eventName: event.name,
      occurredAt: event.occurredAt,
      trainingDayId,
      payload: event.payload,
    };

    const result = await channel.send({
      type: "broadcast",
      event: "domain-event",
      payload: message,
    });

    if (result !== "ok") throw new Error(`Realtime broadcast returned ${result}.`);
  } finally {
    await client.removeChannel(channel);
  }
}
