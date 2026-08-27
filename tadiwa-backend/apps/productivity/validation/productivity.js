import { z } from "zod";

export const setTargetSchema = z.object({
  userId: z.number().int().positive(),
  // Any date within the target week — the service normalizes it to that
  // week's Monday. Accepts "YYYY-MM-DD" or a full ISO timestamp.
  weekStart: z.string().min(1),
  target: z.number().int().min(0).max(1000),
});
