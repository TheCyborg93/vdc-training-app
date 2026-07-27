import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ATTENDANCE_STATUSES = ["EXPECTED", "PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

type AttendanceRow = {
  playerId: number;
  status: AttendanceStatus;
  checkedInAt: Date | null;
  note: string | null;
};

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}

async function requireTrainingDay(trainingDayId: number) {
  const trainingDay = await prisma.trainingDay.findUnique({
    where: { id: trainingDayId },
    select: { id: true, status: true, trainingDate: true, trainingPlan: { select: { title: true } } },
  });
  if (!trainingDay) throw new Error("Trainingstag wurde nicht gefunden.");
  return trainingDay;
}

export async function GET(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

    const trainingDayId = Number(new URL(request.url).searchParams.get("trainingDayId"));
    if (!Number.isInteger(trainingDayId)) return NextResponse.json({ error: "Trainingstag fehlt." }, { status: 400 });

    const [trainingDay, players, roster, assignments, attendance] = await Promise.all([
      requireTrainingDay(trainingDayId),
      prisma.player.findMany({
        where: { active: true },
        orderBy: [{ displayName: "asc" }],
        select: { id: true, displayName: true, firstName: true },
      }),
      prisma.trainingDayPlayer.findMany({ where: { trainingDayId }, select: { playerId: true } }),
      prisma.boardAssignment.findMany({
        where: { trainingDayId },
        select: { playerId: true, boardId: true, board: { select: { name: true } } },
      }),
      prisma.$queryRaw<AttendanceRow[]>`
        SELECT "playerId", "status", "checkedInAt", "note"
        FROM "TrainingAttendance"
        WHERE "trainingDayId" = ${trainingDayId}
      `,
    ]);

    const rosterIds = new Set(roster.map((item) => item.playerId));
    const attendanceByPlayer = new Map(attendance.map((item) => [item.playerId, item]));
    const assignmentByPlayer = new Map(assignments.map((item) => [item.playerId, item]));

    const participants = players.map((player) => {
      const entry = attendanceByPlayer.get(player.id);
      const assignment = assignmentByPlayer.get(player.id);
      const registered = rosterIds.has(player.id);
      return {
        ...player,
        registered,
        status: entry?.status ?? (registered ? "EXPECTED" : "NOT_REGISTERED"),
        checkedInAt: entry?.checkedInAt ?? null,
        note: entry?.note ?? null,
        board: assignment ? { id: assignment.boardId, name: assignment.board.name } : null,
      };
    });

    const registeredParticipants = participants.filter((player) => player.registered);
    const summary = {
      total: registeredParticipants.length,
      present: registeredParticipants.filter((player) => player.status === "PRESENT").length,
      late: registeredParticipants.filter((player) => player.status === "LATE").length,
      expected: registeredParticipants.filter((player) => player.status === "EXPECTED").length,
      absent: registeredParticipants.filter((player) => player.status === "ABSENT").length,
      excused: registeredParticipants.filter((player) => player.status === "EXCUSED").length,
    };

    return NextResponse.json({ trainingDay, participants, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Training attendance GET failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Anwesenheit konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const playerId = Number(body.playerId);
    const status = String(body.status ?? "");
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

    if (!Number.isInteger(trainingDayId) || !Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Trainingstag und Spieler sind erforderlich." }, { status: 400 });
    }
    if (status !== "NOT_REGISTERED" && !isAttendanceStatus(status)) {
      return NextResponse.json({ error: "Ungültiger Anwesenheitsstatus." }, { status: 400 });
    }

    const trainingDay = await requireTrainingDay(trainingDayId);
    if (trainingDay.status === "COMPLETED" || trainingDay.status === "CANCELLED") {
      return NextResponse.json({ error: "Ein beendetes Training kann nicht mehr geändert werden." }, { status: 409 });
    }

    const player = await prisma.player.findFirst({ where: { id: playerId, active: true }, select: { id: true, displayName: true } });
    if (!player) return NextResponse.json({ error: "Spieler wurde nicht gefunden." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const assignment = await tx.boardAssignment.findFirst({
        where: { trainingDayId, playerId },
        select: { id: true, boardId: true, position: true },
      });

      if (status === "NOT_REGISTERED") {
        if (assignment) throw new Error("Entferne den Spieler zuerst über das Board Management vom Board.");
        await tx.trainingDayPlayer.deleteMany({ where: { trainingDayId, playerId } });
        await tx.$executeRaw`DELETE FROM "TrainingAttendance" WHERE "trainingDayId" = ${trainingDayId} AND "playerId" = ${playerId}`;
        return;
      }

      await tx.trainingDayPlayer.upsert({
        where: { trainingDayId_playerId: { trainingDayId, playerId } },
        update: {},
        create: { trainingDayId, playerId },
      });

      if ((status === "ABSENT" || status === "EXCUSED") && assignment) {
        const session = await tx.boardSession.findUnique({
          where: { trainingDayId_boardId: { trainingDayId, boardId: assignment.boardId } },
          select: { status: true },
        });
        if (session && session.status !== "NOT_STARTED") {
          throw new Error("Das Board läuft bereits. Verschiebe den Spieler zuerst über das Board Management auf die Spielerbank.");
        }
        await tx.boardAssignment.delete({ where: { id: assignment.id } });
        const remaining = await tx.boardAssignment.findMany({
          where: { trainingDayId, boardId: assignment.boardId },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        for (let index = 0; index < remaining.length; index += 1) {
          await tx.boardAssignment.update({ where: { id: remaining[index].id }, data: { position: index } });
        }
      }

      const checkedIn = status === "PRESENT" || status === "LATE";
      await tx.$executeRaw`
        INSERT INTO "TrainingAttendance" ("trainingDayId", "playerId", "status", "checkedInAt", "note", "updatedAt")
        VALUES (${trainingDayId}, ${playerId}, ${status}, ${checkedIn ? new Date() : null}, ${note}, CURRENT_TIMESTAMP)
        ON CONFLICT ("trainingDayId", "playerId") DO UPDATE SET
          "status" = EXCLUDED."status",
          "checkedInAt" = CASE
            WHEN EXCLUDED."status" IN ('PRESENT', 'LATE') THEN COALESCE("TrainingAttendance"."checkedInAt", EXCLUDED."checkedInAt")
            ELSE NULL
          END,
          "note" = EXCLUDED."note",
          "updatedAt" = CURRENT_TIMESTAMP
      `;
    });

    return NextResponse.json({ success: true, message: `${player.displayName}: Status aktualisiert.` });
  } catch (error) {
    console.error("Training attendance PATCH failed", error);
    const message = error instanceof Error ? error.message : "Anwesenheit konnte nicht aktualisiert werden.";
    const status = message.includes("zuerst") || message.includes("läuft bereits") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const trainer = await getAuthenticatedTrainer();
    if (!trainer) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

    const body = await request.json();
    const trainingDayId = Number(body.trainingDayId);
    const action = String(body.action ?? "");
    if (!Number.isInteger(trainingDayId) || action !== "mark_registered_present") {
      return NextResponse.json({ error: "Ungültige Sammelaktion." }, { status: 400 });
    }

    const trainingDay = await requireTrainingDay(trainingDayId);
    if (trainingDay.status === "COMPLETED" || trainingDay.status === "CANCELLED") {
      return NextResponse.json({ error: "Ein beendetes Training kann nicht mehr geändert werden." }, { status: 409 });
    }

    const roster = await prisma.trainingDayPlayer.findMany({ where: { trainingDayId }, select: { playerId: true } });
    const now = new Date();
    await prisma.$transaction(
      roster.map(({ playerId }) => prisma.$executeRaw`
        INSERT INTO "TrainingAttendance" ("trainingDayId", "playerId", "status", "checkedInAt", "updatedAt")
        VALUES (${trainingDayId}, ${playerId}, 'PRESENT', ${now}, CURRENT_TIMESTAMP)
        ON CONFLICT ("trainingDayId", "playerId") DO UPDATE SET
          "status" = 'PRESENT',
          "checkedInAt" = COALESCE("TrainingAttendance"."checkedInAt", EXCLUDED."checkedInAt"),
          "updatedAt" = CURRENT_TIMESTAMP
      `),
    );

    return NextResponse.json({ success: true, updated: roster.length, message: `${roster.length} Spieler eingecheckt.` });
  } catch (error) {
    console.error("Training attendance POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sammelaktion fehlgeschlagen." }, { status: 500 });
  }
}
