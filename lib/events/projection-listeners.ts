import type { DomainEvent, DomainEventName } from "@/lib/events/types";
import {
  createActivityProjection,
  createNotificationProjection,
  type ProjectionTone,
} from "@/lib/events/projection-repository";

function trainingDayId(event: DomainEvent) {
  const payload = event.payload as Record<string, unknown>;
  const value = Number(payload.trainingDayId);
  return Number.isInteger(value) ? value : undefined;
}

function boardSessionId(event: DomainEvent) {
  const payload = event.payload as Record<string, unknown>;
  const value = Number(payload.boardSessionId);
  return Number.isInteger(value) ? value : undefined;
}

function describe(event: DomainEvent): {
  title: string;
  message: string;
  tone: ProjectionTone;
  notify?: boolean;
  actionUrl?: string;
} {
  const payload = event.payload as Record<string, unknown>;

  switch (event.name) {
    case "training.day.created":
      return {
        title: "Trainingstag veröffentlicht",
        message: `${Array.isArray(payload.playerIds) ? payload.playerIds.length : 0} Spieler und ${Array.isArray(payload.boardIds) ? payload.boardIds.length : 0} Boards wurden eingeplant.`,
        tone: "SUCCESS",
        notify: true,
        actionUrl: "/trainer/live",
      };
    case "training.finished":
      return {
        title: "Training abgeschlossen",
        message: "Alle Boards haben das Training beendet.",
        tone: "SUCCESS",
        notify: true,
        actionUrl: "/trainer/archiv",
      };
    case "board.paused":
      return { title: "Board pausiert", message: `Board-Session ${payload.boardSessionId} wurde pausiert.`, tone: "WARNING" };
    case "board.resumed":
      return { title: "Board fortgesetzt", message: `Board-Session ${payload.boardSessionId} läuft wieder.`, tone: "INFO" };
    case "board.finished":
      return {
        title: "Board abgeschlossen",
        message: `Board-Session ${payload.boardSessionId} hat das Training beendet.`,
        tone: "SUCCESS",
        notify: true,
        actionUrl: "/trainer/live",
      };
    case "board.player.changed":
      return { title: "Spieler gewechselt", message: `Spieler ${payload.playerId} ist jetzt an der Reihe.`, tone: "INFO" };
    case "board.order.changed":
      return { title: "Reihenfolge geändert", message: "Die Spielerreihenfolge am Board wurde aktualisiert.", tone: "INFO" };
    case "exercise.finished":
      return { title: "Übung abgeschlossen", message: `Übung ${Number(payload.exerciseIndex) + 1} wurde beendet.`, tone: "SUCCESS" };
    case "exercise.changed":
      return { title: "Nächste Übung", message: `Übung ${Number(payload.exerciseIndex) + 1} wurde vorbereitet.`, tone: "INFO" };
    default:
      return { title: event.name, message: "Domain Event verarbeitet.", tone: "INFO" };
  }
}

export async function projectDomainEvent(event: DomainEvent<DomainEventName>) {
  const description = describe(event);
  const dayId = trainingDayId(event);
  const sessionId = boardSessionId(event);

  await createActivityProjection({
    eventId: event.id,
    projectionKey: "activity.default",
    eventName: event.name,
    trainingDayId: dayId,
    boardSessionId: sessionId,
    actorId: event.metadata.actorId,
    audience: "TRAINER",
    tone: description.tone,
    title: description.title,
    message: description.message,
    data: event.payload,
    occurredAt: event.occurredAt,
  });

  await createActivityProjection({
    eventId: event.id,
    projectionKey: "audit.default",
    eventName: event.name,
    trainingDayId: dayId,
    boardSessionId: sessionId,
    actorId: event.metadata.actorId,
    audience: "ADMIN",
    tone: description.tone,
    title: description.title,
    message: description.message,
    data: {
      payload: event.payload,
      metadata: event.metadata,
    },
    occurredAt: event.occurredAt,
  });

  if (description.notify) {
    await createNotificationProjection({
      eventId: event.id,
      projectionKey: "notification.default",
      audience: "TRAINER",
      tone: description.tone,
      title: description.title,
      message: description.message,
      actionUrl: description.actionUrl,
    });
  }
}
