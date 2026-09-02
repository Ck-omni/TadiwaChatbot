import { z } from "zod";

export const createCopilotEscalationSchema = z.object({
  auditRequestId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

// Agents raise (OPEN) via createCopilotEscalationSchema above; from the panel
// they can only move it forward from there — OPEN itself is never a target
// status, same restriction the console's updateEscalationSchema applies.
export const updateCopilotEscalationSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
});
