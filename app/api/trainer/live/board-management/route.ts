import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { prisma } from "@/lib/prisma";
import { createInitialExerciseState, type PlayerExerciseState } from "@/lib/exercise-session-engine";

type ProgressState = {
  order: number[];
  exerciseIndex: number;
  playerIndex: number;
  roundNumber: number;
  playerStates: Record<string, PlayerExerciseState>;
};

function readProgress(value: unknown): ProgressState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];
  const exerciseIndex = Number(data.exerciseIndex);
  const playerIndex = Number(data.playerIndex);
  const roundNumber = Number(data.roundNumber);
  const playerStates = data.playerStates && typeof data.playerStates === "object" && !Array.isArray(data.playerStates)
    ? data.playerStates as Record<string, PlayerExerciseState>
    : {};
  if (!Number.isInteger(exerciseIndex) || !Number.isInteger(playerIndex) || !Number.isInteger(roundNumber)) return null;
  return { order, exerciseIndex, playerIndex, roundNumber, playerStates };
}

function removePlayer(progress: ProgressState, playerId: number): ProgressState {
  const currentPlayerId = progress.order[progress.playerIndex];
  const order = progress.order.filter((id) => id !== playerId);
  const playerStates = { ...progress.playerStates };
  delete playerStates[String(playerId)];
  const currentIndex = currentPlayerId === playerId
    ? Math.min(progress.playerIndex, Math.max(0, order.length - 1))
    : Math.max(0, order.indexOf(currentPlayerId));
  return { ...progress, order, playerIndex: currentIndex, playerStates };
}

function addPlayer(progress: ProgressState, playerId: number, state: PlayerExerciseState): ProgressState {
  if (progress.order.includes(playerId)) return progress;
  return {
    ...progress,
    order: [...progress.order, playerId],
    playerStates: { ...progress.playerStates, [String(playerId)]: state },
  };
}

export async function POST(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für die Boardverwaltung." }, { status: 403 });

    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const playerId = Number(body.playerId);
    const targetBoardId = body.targetBoardId === null ? null : Number(body.targetBoardId);

    if (!Number.isInteger(trainingDayId) || !Number.isInteger(playerId) || (targetBoardId !== null && !Number.isInteger(targetBoardId))) {
      return NextResponse.json({ error: "Trainingstag, Spieler und Zielboard sind erforderlich." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const trainingDay = await tx.trainingDay.findUnique({
        where: { id: trainingDayId },
        select: {
          id: true,
          status: true,
          trainingPlan: {
            select: {
              exercises: {
                orderBy: { position: "asc" },
                select: { exercise: true },
              },
            },
          },
          players: { select: { playerId: true } },
          assignments: { orderBy: [{ boardId: "asc" }, { position: "asc" }] },
          sessions: { select: { id: true, boardId: true, status: true, randomOrderJson: true } },
        },
      });

      if (!trainingDay) throw new Error("Trainingstag wurde nicht gefunden.");
      if (trainingDay.status === "COMPLETED" || trainingDay.status === "CANCELLED") throw new Error("Ein beendetes Training kann nicht mehr umgestellt werden.");
      if (!trainingDay.players.some((entry) => entry.playerId === playerId)) throw new Error("Der Spieler nimmt an diesem Trainingstag nicht teil.");

      const currentAssignment = trainingDay.assignments.find((entry) => entry.playerId === playerId) ?? null;
      const sourceBoardId = currentAssignment?.boardId ?? null;
      if (sourceBoardId === targetBoardId) return { changed: false, sourceBoardId, targetBoardId };

      const sourceSession = sourceBoardId === null ? null : trainingDay.sessions.find((session) => session.boardId === sourceBoardId) ?? null;
      const targetSession = targetBoardId === null ? null : trainingDay.sessions.find((session) => session.boardId === targetBoardId) ?? null;

      if (targetBoardId !== null && !targetSession) throw new Error("Das Zielboard gehört nicht zu diesem Trainingstag.");
      if (sourceSession?.status === "COMPLETED" || targetSession?.status === "COMPLETED") throw new Error("Spieler können nicht in ein abgeschlossenes Board hinein oder daraus heraus verschoben werden.");

      const sourceAssignments = sourceBoardId === null ? [] : trainingDay.assignments.filter((entry) => entry.boardId === sourceBoardId);
      if (sourceSession && sourceSession.status !== "NOT_STARTED" && sourceAssignments.length <= 1) {
        throw new Error("Der letzte Spieler eines laufenden Boards kann nicht verschoben werden.");
      }

      if (currentAssignment) {
        if (targetBoardId === null) {
          await tx.boardAssignment.delete({ where: { id: currentAssignment.id } });
        } else {
          const targetCount = trainingDay.assignments.filter((entry) => entry.boardId === targetBoardId).length;
          await tx.boardAssignment.update({ where: { id: currentAssignment.id }, data: { boardId: targetBoardId, position: targetCount } });
        }
      } else if (targetBoardId !== null) {
        const targetCount = trainingDay.assignments.filter((entry) => entry.boardId === targetBoardId).length;
        await tx.boardAssignment.create({ data: { trainingDayId, boardId: targetBoardId, playerId, position: targetCount } });
      }

      if (sourceBoardId !== null) {
        const remaining = trainingDay.assignments.filter((entry) => entry.boardId === sourceBoardId && entry.playerId !== playerId);
        await Promise.all(remaining.map((entry, index) => tx.boardAssignment.update({ where: { id: entry.id }, data: { position: index } })));
      }

      if (sourceSession) {
        const sourceProgress = readProgress(sourceSession.randomOrderJson);
        if (sourceProgress?.order.includes(playerId)) {
          const next = removePlayer(sourceProgress, playerId);
          await tx.boardSession.update({ where: { id: sourceSession.id }, data: { randomOrderJson: next as Prisma.InputJsonValue } });
        }
      }

      if (targetSession) {
        const targetProgress = readProgress(targetSession.randomOrderJson);
        if (targetProgress && !targetProgress.order.includes(playerId)) {
          const planExercise = trainingDay.trainingPlan.exercises[targetProgress.exerciseIndex]?.exercise;
          if (!planExercise) throw new Error("Die aktuelle Übung des Zielboards konnte nicht geladen werden.");
          const next = addPlayer(targetProgress, playerId, createInitialExerciseState(planExercise));
          await tx.boardSession.update({ where: { id: targetSession.id }, data: { randomOrderJson: next as Prisma.InputJsonValue } });
        }
      }

      return { changed: true, sourceBoardId, targetBoardId };
    });

    return NextResponse.json({ ...result, message: result.changed ? "Spieler wurde neu zugewiesen." : "Zuweisung ist bereits aktuell." });
  } catch (error) {
    console.error("Trainer board management failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Boardzuweisung konnte nicht geändert werden." }, { status: 500 });
  }
}
