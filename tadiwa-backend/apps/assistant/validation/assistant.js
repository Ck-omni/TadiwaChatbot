import { z } from "zod";

// One prior turn of the conversation, as the frontend already renders it —
// see AIAssistant.tsx's local `Message` shape.
const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const askAssistantSchema = z.object({
  message: z.string().min(1, "message is required").max(4000),
  // Capped well above what the UI actually sends (it keeps the full
  // on-screen thread) — just a backstop against an unbounded prompt.
  history: z.array(historyTurnSchema).max(40).optional(),
});
