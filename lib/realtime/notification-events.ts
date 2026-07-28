import { createClient } from "@supabase/supabase-js";
import type { DomainEvent, DomainEventName } from "@/lib/events/types";
import { logger } from "@/lib/logger";
import {
  TRAINER_NOTIFICATION_CHANNEL,
  TRAINER_NOTIFICATION_EVENT,
  type NotificationRealtimeMessage,
} from "@/lib/realtime/notification-types";

export async function broadcastNotificationRefresh(event: DomainEvent<DomainEventName>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    logger.debug("Notification realtime broadcast skipped", {
      eventId: event.id,
      eventName: event.name,
    });
    return;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channel = client.channel(TRAINER_NOTIFICATION_CHANNEL);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Notification realtime subscription timed out.")),
        4_000,
      );

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          reject(new Error(`Notification realtime channel status: ${status}`));
        }
      });
    });

    const result = await channel.send({
      type: "broadcast",
      event: TRAINER_NOTIFICATION_EVENT,
      payload: {
        eventId: event.id,
        eventName: event.name,
        occurredAt: event.occurredAt,
      } satisfies NotificationRealtimeMessage,
    });

    if (result !== "ok") {
      throw new Error(`Notification realtime broadcast returned ${result}.`);
    }
  } finally {
    await client.removeChannel(channel);
  }
}
