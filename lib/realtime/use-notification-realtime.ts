"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  TRAINER_NOTIFICATION_CHANNEL,
  TRAINER_NOTIFICATION_EVENT,
  type NotificationRealtimeMessage,
} from "@/lib/realtime/notification-types";

export type NotificationRealtimeState = "idle" | "connecting" | "connected" | "fallback";

export function useNotificationRealtime(
  enabled: boolean,
  onMessage: (message: NotificationRealtimeMessage) => void | Promise<void>,
) {
  const callbackRef = useRef(onMessage);
  const [state, setState] = useState<NotificationRealtimeState>("idle");

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }

    let active = true;
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel(TRAINER_NOTIFICATION_CHANNEL)
      .on("broadcast", { event: TRAINER_NOTIFICATION_EVENT }, ({ payload }) => {
        if (!active) return;
        void callbackRef.current(payload as NotificationRealtimeMessage);
      });

    setState("connecting");
    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") setState("connected");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setState("fallback");
      }
    });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [enabled]);

  return state;
}
