import type { DomainEventName } from "@/lib/events/types";

export const TRAINER_NOTIFICATION_CHANNEL = "trainer-notifications";
export const TRAINER_NOTIFICATION_EVENT = "notification-refresh";

export type NotificationRealtimeMessage = {
  eventId: string;
  eventName: DomainEventName;
  occurredAt: string;
};
