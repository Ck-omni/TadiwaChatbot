import {z} from "zod";

export const createUserSchema = z.object({
    email: z.string().min(3).max(60),
    password: z.string().min(8),
    fullName: z.string().max(120).optional(),
    role: z.enum(["AGENT", "TEAM_LEAD" , "ADMIN"]).optional(),
});

export const updateUserSchema = z
    .object({
        fullName: z.string().max(120).optional(),
        role: z.enum(["AGENT", "TEAM_LEAD", "ADMIN"]).optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0 ,{
        message: "At least one field must be provided",
    });

// Self-service profile edit — deliberately has no `role`/`isActive` field at
// all, not even omitted-but-allowed: a user can never change their own role
// or reactivate/deactivate themselves through this endpoint, regardless of
// what role they hold. That stays exclusively in the admin-only updateUserSchema flow.
export const updateOwnProfileSchema = z
    .object({
        fullName: z.string().min(1).max(120).optional(),
        email: z.string().email().max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});

