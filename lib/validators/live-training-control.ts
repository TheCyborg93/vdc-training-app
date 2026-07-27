import { z } from "zod";

export const liveBoardActionSchema = z.discriminatedUnion("action", [
  z.object({ boardSessionId: z.coerce.number().int().positive(), action: z.literal("pause") }),
  z.object({ boardSessionId: z.coerce.number().int().positive(), action: z.literal("resume") }),
  z.object({ boardSessionId: z.coerce.number().int().positive(), action: z.literal("skip") }),
  z.object({ boardSessionId: z.coerce.number().int().positive(), action: z.literal("finish_exercise") }),
  z.object({ boardSessionId: z.coerce.number().int().positive(), action: z.literal("finish_board") }),
  z.object({
    boardSessionId: z.coerce.number().int().positive(),
    action: z.literal("reorder"),
    order: z.array(z.coerce.number().int().positive()).min(1),
  }),
]);

export type LiveBoardActionInput = z.infer<typeof liveBoardActionSchema>;
