import { z } from "zod";

const positiveId = z.coerce.number().int().positive();

export const trainingDayAssignmentSchema = z.object({
  boardId: positiveId,
  playerId: positiveId,
  position: z.coerce.number().int().positive(),
});

export const publishTrainingDaySchema = z.object({
  trainingPlanId: positiveId,
  trainingDate: z.coerce.date(),
  boardIds: z.array(positiveId).min(1).transform((items) => [...new Set(items)]),
  playerIds: z.array(positiveId).min(1).transform((items) => [...new Set(items)]),
  assignments: z.array(trainingDayAssignmentSchema).min(1),
}).superRefine((value, context) => {
  const assignedPlayers = new Set(value.assignments.map((item) => item.playerId));
  const boardPositions = new Set(value.assignments.map((item) => `${item.boardId}:${item.position}`));

  if (value.assignments.length !== value.playerIds.length || assignedPlayers.size !== value.playerIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assignments"],
      message: "Jeder ausgewählte Spieler muss genau einmal einem Board zugewiesen sein.",
    });
  }

  if (boardPositions.size !== value.assignments.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assignments"],
      message: "Eine Boardposition darf nicht mehrfach vergeben werden.",
    });
  }

  for (const assignment of value.assignments) {
    if (!value.boardIds.includes(assignment.boardId) || !value.playerIds.includes(assignment.playerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignments"],
        message: "Die Board-Verteilung enthält nicht ausgewählte Spieler oder Boards.",
      });
      break;
    }
  }
});

export type PublishTrainingDayInput = z.infer<typeof publishTrainingDaySchema>;
