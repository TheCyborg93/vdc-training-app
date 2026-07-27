"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ActivityData = {
  currentWeekDays: number;
  weeklyTarget: number;
  streak: number;
  weeks: { key: string; label: string; activeDays: number; days: { date: string; active: boolean }[] }[];
  focus: string;
  focusCounts: { name: string; count: number }[];
  recommendation: string;
  completedHomeSessions: number;
};

export type QuickstartData = {
  activeSession: { id: number; homeTrainingPlanId: number; status: string } | null;
  priorityFocus: string;
  weekProgress: number;
  weeklyTarget: number;
  recommendations: { id: number; title: string; goal: string; durationMin: number; exerciseCount: number; priority: boolean }[];
  suggestedDays: { date: string; label: string; focus: string }[];
};

export type HistoryData = {
  summary: { sessions: number; minutes: number; results: number; averageMinutes: number };
  sessions: {
    id: number;
    title: string;
    goal: string;
    plannedMinutes: number;
    actualMinutes: number;
    startedAt: string;
    completedAt: string | null;
    resultCount: number;
    exerciseCount: number;
    strongest: { exercise: string; score: number | null; resultType: string } | null;
  }[];
  bestResults: { exercise: string; score: number; resultType: string; createdAt: string }[];
};

export type Milestone = {
  key: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  unlocked: boolean;
};

export type MilestoneData = {
  summary: { unlocked: number; total: number; activityDays: number; completedSessions: number; totalResults: number; totalMinutes: number; bestScore: number };
  next: Milestone | null;
  milestones: Milestone[];
};

export type TrendData = {
  current: { results: number; activeDays: number; average: number | null; best: number | null; checkoutRate: number | null };
  previous: { results: number; activeDays: number; average: number | null; best: number | null; checkoutRate: number | null };
  deltas: { results: number; activeDays: number; average: number | null; best: number | null; checkoutRate: number | null };
  bestImprovement: { exercise: string; currentAverage: number; previousAverage: number; delta: number } | null;
  weeks: { key: string; label: string; results: number; activeDays: number; average: number | null }[];
  period: { current: string; previous: string };
};

type InsightsPayload = {
  playerId: number;
  activity: ActivityData;
  quickstart: QuickstartData;
  history: HistoryData;
  milestones: MilestoneData;
  trends: TrendData;
  generatedAt: string;
};

type InsightsContextValue = {
  playerId: number | null;
  data: InsightsPayload | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};

const InsightsContext = createContext<InsightsContextValue | null>(null);
const memoryCache = new Map<number, { data: InsightsPayload; expiresAt: number }>();

export function HomeInsightsProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const selectCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const connect = () => {
      const select = document.querySelector<HTMLSelectElement>("#home-player");
      if (!select) {
        timer = window.setTimeout(connect, 100);
        return;
      }
      const sync = () => {
        const value = Number(select.value);
        if (!cancelled && Number.isInteger(value)) setPlayerId(value);
      };
      sync();
      select.addEventListener("change", sync);
      selectCleanup.current = () => select.removeEventListener("change", sync);
    };

    connect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      selectCleanup.current?.();
    };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    const cached = memoryCache.get(playerId);
    if (cached && cached.expiresAt > Date.now() && version === 0) {
      setData(cached.data);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/home-training/insights?playerId=${playerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Spielerdaten konnten nicht geladen werden.");
        const typed = payload as InsightsPayload;
        memoryCache.set(playerId, { data: typed, expiresAt: Date.now() + 30_000 });
        setData(typed);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Spielerdaten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [playerId, version]);

  const refresh = useCallback(() => {
    if (playerId) memoryCache.delete(playerId);
    setVersion((value) => value + 1);
  }, [playerId]);

  const value = useMemo(() => ({ playerId, data, loading, error, refresh }), [playerId, data, loading, error, refresh]);
  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useHomeInsights() {
  const context = useContext(InsightsContext);
  if (!context) throw new Error("useHomeInsights muss innerhalb von HomeInsightsProvider verwendet werden.");
  return context;
}
