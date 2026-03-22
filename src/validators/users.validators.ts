import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  avatarUrl: z.string().trim().url().optional(),
  roleIds: z.array(z.string().uuid()).min(1),
});

export const listUsersSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    avatarUrl: z.string().trim().url().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
