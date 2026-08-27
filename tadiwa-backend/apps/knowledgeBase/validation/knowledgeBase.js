import { z } from "zod";
 
export const createKnowledgeBaseSchema = z.object({
  topic: z.string().min(1, "topic is required").max(255),
  content: z.string().min(1, "content is required"),
});
 
export const updateKnowledgeBaseSchema = z
  .object({
    topic: z.string().min(1).max(255).optional(),
    content: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });