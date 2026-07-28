import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import {
  findNotifications,
  markNotificationRead,
} from "@/lib/events/projection-repository";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  notificationId: z.coerce.number().int().positive(),
});

export async function GET(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Benachrichtigungen." }, { status: 403 });

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(rawLimit) ? rawLimit : 30;
    const notifications = await findNotifications({ userId: trainer.id, role: trainer.role, limit });

    return NextResponse.json({
      unread: notifications.filter((item) => item.readAt === null).length,
      notifications: notifications.map((item) => ({
        ...item,
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Notification list failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Benachrichtigungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const trainer = await getAuthenticatedTrainer();
  if (!trainer) return NextResponse.json({ error: "Keine Berechtigung für Benachrichtigungen." }, { status: 403 });

  try {
    const parsed = markReadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Benachrichtigung." }, { status: 400 });
    }

    const changed = await markNotificationRead(parsed.data.notificationId, trainer.id);
    if (changed === 0) return NextResponse.json({ error: "Benachrichtigung wurde nicht gefunden." }, { status: 404 });
    return NextResponse.json({ read: true });
  } catch (error) {
    logger.error("Notification read update failed", error, { trainerId: trainer.id });
    return NextResponse.json({ error: "Benachrichtigung konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
