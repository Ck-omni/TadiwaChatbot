import { z } from "zod";

export const sendMessageSchema = z.object({
  recipientId: z.number().int().positive(),
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message is too long"),
});
