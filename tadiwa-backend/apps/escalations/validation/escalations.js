import { z } from "zod";

export const updateEscalationSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
});