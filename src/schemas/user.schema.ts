import { z } from "zod";

export const updateCurrentUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters")
      .optional(),

    avatarUrl: z
      .string()
      .trim()
      .url("Avatar URL must be a valid URL")
      .max(500, "Avatar URL must not exceed 500 characters")
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.avatarUrl !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(128, "Current password must not exceed 128 characters"),

    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "New password must not exceed 128 characters"),
  })
  .refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message:
        "New password must be different from the current password",
      path: ["newPassword"],
    },
  );

export type UpdateCurrentUserInput = z.infer<
  typeof updateCurrentUserSchema
>;

export type ChangePasswordInput = z.infer<
  typeof changePasswordSchema
>;