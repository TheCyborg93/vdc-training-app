export type LiveBoardStatus = "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED";

export type LivePlayer = {
  id: number;
  displayName: string;
};

export type LiveExercise = {
  id: number;
  name: string;
  description?: string;
};

export type LiveBoardSnapshot = {
  id: number;
  board: {
    id: number;
    name: string;
    location?: string | null;
    available?: boolean;
  };
  status: LiveBoardStatus;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  lastResultAt: string | Date | null;
  players: LivePlayer[];
  currentPlayer: LivePlayer | null;
  currentExercise: LiveExercise | null;
  exerciseIndex: number;
  totalExercises: number;
  progressPercent: number;
  resultCount: number;
};

export type LiveTrainingSnapshot = {
  id: number;
  trainingDate: string | Date;
  status: string;
  trainingPlan: {
    title: string;
    goal: string;
    durationMin: number;
  };
  roster: LivePlayer[];
  unassignedPlayers: LivePlayer[];
  boards: LiveBoardSnapshot[];
};

export type CoachHealthLevel = "critical" | "warning" | "waiting" | "good" | "done";

export type CoachHealth = {
  level: CoachHealthLevel;
  label: string;
  detail: string;
  idleMinutes: number | null;
};
