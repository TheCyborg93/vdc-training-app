import type { CoachHealth, CoachHealthLevel, LiveBoardSnapshot } from "./types";

export const coachHealthPriority: Record<CoachHealthLevel, number> = {
  critical: 0,
  warning: 1,
  waiting: 2,
  good: 3,
  done: 4,
};

function toTimestamp(value: string | Date | null) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function minutesSince(value: string | Date | null, now: Date = new Date()) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
}

export function getBoardCoachHealth(board: LiveBoardSnapshot, now: Date = new Date()): CoachHealth {
  if (board.status === "COMPLETED") {
    return { level: "done", label: "Fertig", detail: "Training abgeschlossen", idleMinutes: null };
  }
  if (board.status === "PAUSED") {
    return { level: "warning", label: "Pausiert", detail: "Stand ist gespeichert", idleMinutes: null };
  }
  if (board.status === "NOT_STARTED") {
    return { level: "waiting", label: "Wartet", detail: "Noch nicht gestartet", idleMinutes: null };
  }

  const idleMinutes = minutesSince(board.lastResultAt ?? board.startedAt, now) ?? 0;
  if (idleMinutes >= 8) {
    return { level: "critical", label: "Eingreifen", detail: `${idleMinutes} Min. ohne Eingabe`, idleMinutes };
  }
  if (idleMinutes >= 4) {
    return { level: "warning", label: "Beobachten", detail: `${idleMinutes} Min. ohne Eingabe`, idleMinutes };
  }
  return {
    level: "good",
    label: "Läuft gut",
    detail: board.lastResultAt ? `Eingabe vor ${idleMinutes} Min.` : "Gerade gestartet",
    idleMinutes,
  };
}

export function sortBoardsByCoachPriority(boards: LiveBoardSnapshot[], now: Date = new Date()) {
  return boards
    .map((board) => ({ board, health: getBoardCoachHealth(board, now) }))
    .sort(
      (a, b) =>
        coachHealthPriority[a.health.level] - coachHealthPriority[b.health.level] ||
        a.board.progressPercent - b.board.progressPercent,
    );
}
