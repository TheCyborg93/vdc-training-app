import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Strategy = "BALANCED" | "MENTORING" | "SIMILAR";
type AttendanceRow = { playerId: number; status: string };
type PlayerProfile = {
  id: number;
  displayName: string;
  skillLevel: number | null;
  averageScore: number | null;
  resultCount: number;
  rating: number;
};

type SuggestedBoard = {
  boardId: number;
  boardName: string;
  players: PlayerProfile[];
  averageRating: number;
};

function normalizeStrategy(value: unknown): Strategy {
  return value === "MENTORING" || value === "SIMILAR" ? value : "BALANCED";
}

function playerRating(skillLevel: number | null, averageScore: number | null, resultCount: number) {
  const skill = skillLevel === null ? 50 : Math.max(1, Math.min(100, skillLevel * 10));
  const score = averageScore === null ? skill : Math.max(1, Math.min(100, averageScore));
  const confidence = Math.min(1, resultCount / 20);
  return Math.round((skill * (1 - confidence * 0.55) + score * confidence * 0.55) * 10) / 10;
}

function distribute(players: PlayerProfile[], boards: { id: number; name: string }[], strategy: Strategy): SuggestedBoard[] {
  const groups = boards.map((board) => ({ boardId: board.id, boardName: board.name, players: [] as PlayerProfile[], averageRating: 0 }));
  if (!groups.length) return groups;

  const sorted = [...players].sort((a, b) => b.rating - a.rating);

  if (strategy === "SIMILAR") {
    const size = Math.ceil(sorted.length / groups.length);
    groups.forEach((group, index) => {
      group.players = sorted.slice(index * size, (index + 1) * size);
    });
  } else if (strategy === "MENTORING") {
    let left = 0;
    let right = sorted.length - 1;
    let boardIndex = 0;
    while (left <= right) {
      groups[boardIndex % groups.length].players.push(sorted[left]);
      left += 1;
      if (left <= right) {
        groups[boardIndex % groups.length].players.push(sorted[right]);
        right -= 1;
      }
      boardIndex += 1;
    }
  } else {
    for (const player of sorted) {
      const target = [...groups].sort((a, b) => {
        if (a.players.length !== b.players.length) return a.players.length - b.players.length;
        const sumA = a.players.reduce((sum, item) => sum + item.rating, 0);
        const sumB = b.players.reduce((sum, item) => sum + item.rating, 0);
        return sumA - sumB;
      })[0];
      target.players.push(player);
    }
  }

  for (const group of groups) {
    group.averageRating = group.players.length
      ? Math.round((group.players.reduce((sum, player) => sum + player.rating, 0) / group.players.length) * 10) / 10
      : 0;
  }
  return groups;
}

async function buildSuggestion(trainingDayId: number, strategy: Strategy) {
  const since = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000);
  const [trainingDay, attendance, recentResults] = await Promise.all([
    prisma.trainingDay.findUnique({
      where: { id: trainingDayId },
      select: {
        id: true,
        status: true,
        trainingPlan: { select: { title: true, goal: true } },
        players: { select: { player: { select: { id: true, displayName: true, skillLevel: true } } } },
        boards: { select: { board: { select: { id: true, name: true, available: true } } } },
        sessions: { select: { boardId: true, status: true } },
      },
    }),
    prisma.$queryRaw<AttendanceRow[]>`
      SELECT "playerId", "status" FROM "TrainingAttendance" WHERE "trainingDayId" = ${trainingDayId}
    `,
    prisma.exerciseResult.groupBy({
      by: ["playerId"],
      where: { createdAt: { gte: since }, deletedAt: null, calculatedScore: { not: null } },
      _avg: { calculatedScore: true },
      _count: { _all: true },
    }),
  ]);

  if (!trainingDay) throw new Error("Trainingstag wurde nicht gefunden.");
  if (trainingDay.status === "COMPLETED" || trainingDay.status === "CANCELLED") throw new Error("Für ein beendetes Training kann keine Einteilung erstellt werden.");

  const attendanceMap = new Map(attendance.map((entry) => [entry.playerId, entry.status]));
  const checkedIn = trainingDay.players
    .map((entry) => entry.player)
    .filter((player) => {
      const status = attendanceMap.get(player.id);
      return status === "PRESENT" || status === "LATE";
    });
  const participants = checkedIn.length ? checkedIn : trainingDay.players.map((entry) => entry.player).filter((player) => {
    const status = attendanceMap.get(player.id);
    return status !== "ABSENT" && status !== "EXCUSED";
  });

  const resultMap = new Map(recentResults.map((entry) => [entry.playerId, entry]));
  const profiles: PlayerProfile[] = participants.map((player) => {
    const result = resultMap.get(player.id);
    const averageScore = result?._avg.calculatedScore === null || result?._avg.calculatedScore === undefined
      ? null
      : Math.round(Number(result._avg.calculatedScore) * 10) / 10;
    const resultCount = result?._count._all ?? 0;
    return {
      ...player,
      averageScore,
      resultCount,
      rating: playerRating(player.skillLevel, averageScore, resultCount),
    };
  });

  const usableBoards = trainingDay.boards
    .map((entry) => entry.board)
    .filter((board) => board.available)
    .filter((board) => trainingDay.sessions.find((session) => session.boardId === board.id)?.status !== "COMPLETED");
  const requiredBoards = Math.max(1, Math.min(usableBoards.length, Math.ceil(profiles.length / 3)));
  const selectedBoards = usableBoards.slice(0, requiredBoards);
  const groups = distribute(profiles, selectedBoards, strategy);
  const ratings = groups.filter((group) => group.players.length).map((group) => group.averageRating);
  const spread = ratings.length ? Math.round((Math.max(...ratings) - Math.min(...ratings)) * 10) / 10 : 0;
  const canApply = trainingDay.sessions.every((session) => session.status === "NOT_STARTED");

  return {
    trainingDay: { id: trainingDay.id, title: trainingDay.trainingPlan.title, goal: trainingDay.trainingPlan.goal, status: trainingDay.status },
    strategy,
    usedCheckedInPlayers: checkedIn.length > 0,
    playerCount: profiles.length,
    availableBoardCount: usableBoards.length,
    groups,
    quality: {
      spread,
      label: spread <= 8 ? "Sehr ausgewogen" : spread <= 15 ? "Ausgewogen" : "Deutliche Leistungsunterschiede",
    },
    canApply,
    warning: canApply ? null : "Die automatische Einteilung kann nur übernommen werden, solange alle Boards noch nicht gestartet wurden.",
  };
}

export async function GET(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    const url = new URL(request.url);
    const trainingDayId = Number(url.searchParams.get("trainingDayId"));
    const strategy = normalizeStrategy(url.searchParams.get("strategy"));
    if (!Number.isInteger(trainingDayId)) return NextResponse.json({ error: "Trainingstag fehlt." }, { status: 400 });
    return NextResponse.json(await buildSuggestion(trainingDayId, strategy), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Live grouping GET failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Einteilung konnte nicht erstellt werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const strategy = normalizeStrategy(body.strategy);
    if (!Number.isInteger(trainingDayId)) return NextResponse.json({ error: "Trainingstag fehlt." }, { status: 400 });

    const suggestion = await buildSuggestion(trainingDayId, strategy);
    if (!suggestion.canApply) return NextResponse.json({ error: suggestion.warning }, { status: 409 });
    if (!suggestion.groups.some((group) => group.players.length)) return NextResponse.json({ error: "Es sind keine anwesenden Spieler für die Einteilung vorhanden." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.boardAssignment.deleteMany({ where: { trainingDayId } });
      for (const group of suggestion.groups) {
        for (let position = 0; position < group.players.length; position += 1) {
          await tx.boardAssignment.create({
            data: { trainingDayId, boardId: group.boardId, playerId: group.players[position].id, position },
          });
        }
      }
    });

    return NextResponse.json({ success: true, groups: suggestion.groups, message: `${suggestion.playerCount} Spieler auf ${suggestion.groups.filter((group) => group.players.length).length} Boards verteilt.` });
  } catch (error) {
    console.error("Live grouping POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Einteilung konnte nicht übernommen werden." }, { status: 500 });
  }
}
