import { prisma } from "@/lib/prisma";

export type TrainingHistoryType = "CLUB" | "HOME";

export type TrainingHistoryFilters = {
  playerId?: number;
  type?: TrainingHistoryType;
  periodDays?: number;
  query?: string;
  limit?: number;
  offset?: number;
};

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null;
}

export async function getTrainingHistory(filters: TrainingHistoryFilters = {}) {
  const periodDays = Math.max(7, Math.min(3650, filters.periodDays ?? 365));
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const query = filters.query?.trim().toLowerCase() ?? "";
  const includeClub = !filters.type || filters.type === "CLUB";
  const includeHome = !filters.type || filters.type === "HOME";

  const [clubDays, homeSessions] = await Promise.all([
    includeClub ? prisma.trainingDay.findMany({
      where: {
        status: "COMPLETED",
        trainingDate: { gte: since },
        ...(filters.playerId ? { assignments: { some: { playerId: filters.playerId } } } : {}),
      },
      orderBy: { trainingDate: "desc" },
      include: {
        trainingPlan: { include: { exercises: { include: { exercise: true }, orderBy: { position: "asc" } } } },
        assignments: { include: { player: true, board: true } },
        sessions: { include: { results: { where: { deletedAt: null }, select: { calculatedScore: true, exerciseId: true } } } },
      },
    }) : Promise.resolve([]),
    includeHome ? prisma.homeTrainingSession.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: since },
        ...(filters.playerId ? { playerId: filters.playerId } : {}),
      },
      orderBy: { completedAt: "desc" },
      include: {
        player: true,
        plan: true,
        results: { where: { deletedAt: null }, include: { exercise: true } },
      },
    }) : Promise.resolve([]),
  ]);

  const club = clubDays.map((day) => {
    const results = day.sessions.flatMap((session) => session.results);
    const scores = results.map((result) => numberOrNull(result.calculatedScore)).filter((value): value is number => value !== null);
    const players = [...new Map(day.assignments.map((assignment) => [assignment.player.id, assignment.player])).values()];
    const boards = [...new Map(day.assignments.map((assignment) => [assignment.board.id, assignment.board])).values()];
    return {
      id: `club:${day.id}`,
      sourceId: day.id,
      type: "CLUB" as const,
      title: day.trainingPlan.title,
      goal: day.trainingPlan.goal,
      startedAt: day.trainingDate.toISOString(),
      completedAt: day.sessions.map((session) => session.completedAt).filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null,
      durationMin: day.trainingPlan.durationMin,
      players: players.map((player) => ({ id: player.id, name: player.displayName })),
      boards: boards.map((board) => board.name),
      exercises: day.trainingPlan.exercises.map((entry) => entry.exercise.name),
      resultCount: results.length,
      average: average(scores),
      highScore: scores.length ? Math.max(...scores) : null,
      detailHref: `/trainer/archiv/club/${day.id}`,
    };
  });

  const home = homeSessions.map((session) => {
    const scores = session.results.map((result) => numberOrNull(result.calculatedScore)).filter((value): value is number => value !== null);
    const exercises = [...new Set(session.results.map((result) => result.exercise.name))];
    const startedAt = session.startedAt;
    const completedAt = session.completedAt;
    const measuredMinutes = completedAt ? Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000)) : session.plan.durationMin;
    return {
      id: `home:${session.id}`,
      sourceId: session.id,
      type: "HOME" as const,
      title: session.plan.title,
      goal: session.plan.goal,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt?.toISOString() ?? null,
      durationMin: measuredMinutes,
      players: [{ id: session.player.id, name: session.player.displayName }],
      boards: [] as string[],
      exercises,
      resultCount: session.results.length,
      average: average(scores),
      highScore: scores.length ? Math.max(...scores) : null,
      detailHref: `/trainer/archiv/home/${session.id}`,
    };
  });

  const all = [...club, ...home]
    .filter((item) => !query || `${item.title} ${item.goal} ${item.players.map((player) => player.name).join(" ")} ${item.exercises.join(" ")}`.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 30));
  const items = all.slice(offset, offset + limit);
  const totalMinutes = all.reduce((sum, item) => sum + item.durationMin, 0);
  const resultCount = all.reduce((sum, item) => sum + item.resultCount, 0);
  const scoredAverages = all.map((item) => item.average).filter((value): value is number => value !== null);

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    total: all.length,
    offset,
    limit,
    hasMore: offset + items.length < all.length,
    summary: {
      sessions: all.length,
      clubSessions: all.filter((item) => item.type === "CLUB").length,
      homeSessions: all.filter((item) => item.type === "HOME").length,
      totalMinutes,
      resultCount,
      players: new Set(all.flatMap((item) => item.players.map((player) => player.id))).size,
      average: average(scoredAverages),
    },
    items,
  };
}
