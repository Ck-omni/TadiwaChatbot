import { z } from "zod";

export const createShiftBlockSchema = z.object({
  userId: z.number().int().positive(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  task: z.string().min(1).max(200),
});

export const updateShiftBlockSchema = z
  .object({
    startsAt: z.string().min(1).optional(),
    endsAt: z.string().min(1).optional(),
    task: z.string().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
