"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TrainingRealtimeMessage } from "@/lib/realtime/training-events";

export type RealtimeConnectionState = "idle" | "connecting" | "connected" | "fallback";

export function useTrainingRealtime(
  trainingDayId: number | null,
  onMessage: (message: TrainingRealtimeMessage) => void | Promise<void>,
) {
  const callbackRef = useRef(onMessage);
  const [state, setState] = useState<RealtimeConnectionState>("idle");

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!trainingDayId) {
      setState("idle");
      return;
    }

    let active = true;
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel(`training:${trainingDayId}`)
      .on("broadcast", { event: "domain-event" }, ({ payload }) => {
        if (!active) return;
        void callbackRef.current(payload as TrainingRealtimeMessage);
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
  }, [trainingDayId]);

  return state;
}
