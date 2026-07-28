import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectionAudience = "TRAINER" | "ADMIN" | "ALL";
export type ProjectionTone = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export type ActivityProjectionInput = {
  eventId: string;
  projectionKey: string;
  eventName: string;
  trainingDayId?: number;
  boardSessionId?: number;
  actorId?: number;
  audience?: ProjectionAudience;
  tone?: ProjectionTone;
  title: string;
  message: string;
  data?: unknown;
  occurredAt: string;
};

export type NotificationProjectionInput = {
  eventId: string;
  projectionKey: string;
  recipientUserId?: number;
  audience?: ProjectionAudience;
  tone?: ProjectionTone;
  title: string;
  message: string;
  actionUrl?: string;
};

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

export async function createActivityProjection(input: ActivityProjectionInput) {
  await prisma.$executeRaw`
    INSERT INTO "EventActivity" (
      "eventId", "projectionKey", "eventName", "trainingDayId", "boardSessionId",
      "actorId", "audience", "tone", "title", "message", "dataJson", "occurredAt"
    ) VALUES (
      ${input.eventId}, ${input.projectionKey}, ${input.eventName}, ${input.trainingDayId ?? null},
      ${input.boardSessionId ?? null}, ${input.actorId ?? null},
      CAST(${input.audience ?? "TRAINER"} AS "ActivityAudience"),
      CAST(${input.tone ?? "INFO"} AS "ActivityTone"),
      ${input.title}, ${input.message}, CAST(${json(input.data)} AS JSONB), ${new Date(input.occurredAt)}
    )
    ON CONFLICT ("eventId", "projectionKey") DO NOTHING
  `;
}

export async function createNotificationProjection(input: NotificationProjectionInput) {
  await prisma.$executeRaw`
    INSERT INTO "AppNotification" (
      "eventId", "projectionKey", "recipientUserId", "audience", "tone",
      "title", "message", "actionUrl"
    ) VALUES (
      ${input.eventId}, ${input.projectionKey}, ${input.recipientUserId ?? null},
      CAST(${input.audience ?? "TRAINER"} AS "ActivityAudience"),
      CAST(${input.tone ?? "INFO"} AS "ActivityTone"),
      ${input.title}, ${input.message}, ${input.actionUrl ?? null}
    )
    ON CONFLICT DO NOTHING
  `;
}

export type ActivityRow = {
  id: number;
  eventId: string;
  eventName: string;
  trainingDayId: number | null;
  boardSessionId: number | null;
  actorId: number | null;
  audience: ProjectionAudience;
  tone: ProjectionTone;
  title: string;
  message: string;
  dataJson: Prisma.JsonValue | null;
  occurredAt: Date;
};

export async function findRecentActivities(input: {
  trainingDayId?: number;
  audience?: ProjectionAudience;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  return prisma.$queryRaw<ActivityRow[]>`
    SELECT "id", "eventId", "eventName", "trainingDayId", "boardSessionId", "actorId",
           "audience", "tone", "title", "message", "dataJson", "occurredAt"
    FROM "EventActivity"
    WHERE (${input.trainingDayId ?? null}::INTEGER IS NULL OR "trainingDayId" = ${input.trainingDayId ?? null})
      AND (${input.audience ?? null}::TEXT IS NULL OR "audience"::TEXT IN (${input.audience ?? null}, 'ALL'))
    ORDER BY "occurredAt" DESC
    LIMIT ${limit}
  `;
}

export type NotificationRow = {
  id: number;
  audience: ProjectionAudience;
  tone: ProjectionTone;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function findNotifications(input: {
  userId: number;
  role: "ADMIN" | "TRAINER";
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  return prisma.$queryRaw<NotificationRow[]>`
    SELECT "id", "audience", "tone", "title", "message", "actionUrl", "readAt", "createdAt"
    FROM "AppNotification"
    WHERE ("recipientUserId" = ${input.userId} OR "recipientUserId" IS NULL)
      AND "audience"::TEXT IN (${input.role}, 'ALL')
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  return prisma.$executeRaw`
    UPDATE "AppNotification"
    SET "readAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${notificationId}
      AND ("recipientUserId" = ${userId} OR "recipientUserId" IS NULL)
  `;
}
