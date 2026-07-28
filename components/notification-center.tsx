"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotificationRealtime } from "@/lib/realtime/use-notification-realtime";

type NotificationItem = {
  id: number;
  audience: "TRAINER" | "ADMIN" | "ALL";
  tone: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationResponse = {
  unread: number;
  notifications: NotificationItem[];
};

export default function NotificationCenter({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NotificationResponse>({ unread: 0, notifications: [] });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!enabled || document.visibilityState !== "visible") return;
    setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=20", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as NotificationResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const handleRealtimeMessage = useCallback(() => {
    void load();
  }, [load]);

  const realtimeState = useNotificationRealtime(enabled, handleRealtimeMessage);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const timer = window.setInterval(
      () => void load(),
      realtimeState === "connected" ? 60_000 : 15_000,
    );
    return () => window.clearInterval(timer);
  }, [enabled, load, realtimeState]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: item.id }),
    });
    if (!response.ok) return;
    setData((current) => ({
      unread: Math.max(0, current.unread - 1),
      notifications: current.notifications.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ),
    }));
  }

  if (!enabled) return null;

  return (
    <div className="vdc-notification-center" ref={rootRef}>
      <button
        className={`vdc-notification-trigger ${data.unread > 0 ? "has-unread" : ""}`}
        type="button"
        aria-label={`${data.unread} ungelesene Benachrichtigungen`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {data.unread > 0 && <span>{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>

      {open && (
        <section className="vdc-notification-panel" aria-label="Benachrichtigungen">
          <header>
            <div>
              <small>LIVE CENTER</small>
              <strong>Benachrichtigungen</strong>
            </div>
            <span className={`is-${realtimeState}`}>
              <i />
              {realtimeState === "connected" ? "Echtzeit" : "Fallback"}
            </span>
          </header>

          <div className="vdc-notification-list">
            {data.notifications.map((item) => {
              const content = (
                <>
                  <i className={`is-${item.tone.toLowerCase()}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <time>
                      {new Date(item.createdAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </>
              );

              return item.actionUrl ? (
                <Link
                  className={item.readAt ? "is-read" : "is-unread"}
                  href={item.actionUrl}
                  key={item.id}
                  onClick={() => {
                    void markRead(item);
                    setOpen(false);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  className={item.readAt ? "is-read" : "is-unread"}
                  type="button"
                  key={item.id}
                  onClick={() => void markRead(item)}
                >
                  {content}
                </button>
              );
            })}

            {!loading && data.notifications.length === 0 && (
              <p className="vdc-notification-empty">Noch keine Benachrichtigungen.</p>
            )}
            {loading && data.notifications.length === 0 && (
              <p className="vdc-notification-empty">Benachrichtigungen werden geladen …</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
