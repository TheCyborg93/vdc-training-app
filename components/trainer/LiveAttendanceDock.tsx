"use client";

import { useCallback, useEffect, useState } from "react";
import LiveAttendancePanel from "@/components/trainer/LiveAttendancePanel";

type LiveTrainingRef = { id: number; status: string } | null;

export default function LiveAttendanceDock() {
  const [training, setTraining] = useState<LiveTrainingRef>(null);

  const loadTraining = useCallback(async () => {
    try {
      const response = await fetch("/api/trainer/live", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setTraining(payload ? { id: Number(payload.id), status: String(payload.status) } : null);
    } catch {
      // The main Live Center already displays connection errors.
    }
  }, []);

  useEffect(() => {
    void loadTraining();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadTraining();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadTraining]);

  if (!training || training.status === "COMPLETED") return null;

  return (
    <aside className="phase6-attendance-dock" aria-label="Anwesenheit verwalten">
      <LiveAttendancePanel trainingDayId={training.id} onChanged={loadTraining} />
    </aside>
  );
}
