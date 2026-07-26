"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) return "00:00:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function TrainingCountdown({ target }: { target: string | null }) {
  const targetTime = useMemo(() => (target ? new Date(target).getTime() : null), [target]);
  const [remaining, setRemaining] = useState(() => (targetTime ? targetTime - Date.now() : 0));

  useEffect(() => {
    if (!targetTime) return;
    const update = () => setRemaining(targetTime - Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [targetTime]);

  if (!targetTime) {
    return <strong className="vdc-v3-countdown-value is-empty">–</strong>;
  }

  if (remaining <= 0) {
    return <strong className="vdc-v3-countdown-value is-live">JETZT</strong>;
  }

  return <strong className="vdc-v3-countdown-value">{formatRemaining(remaining)}</strong>;
}
