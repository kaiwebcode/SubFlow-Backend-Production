import { z } from "zod";

export const deviceIdSchema = z.object({
  id: z.uuid("Invalid device ID"),
});

export const createDeviceSchema = z.object({
  deviceId: z
    .string()
    .trim()
    .min(1, "Device ID is required")
    .max(255, "Device ID must be at most 255 characters"),

  pushToken: z
    .string()
    .trim()
    .min(1, "Push token is required")
    .max(500, "Push token must be at most 500 characters"),

  platform: z
    .string()
    .trim()
    .min(1, "Platform is required")
    .max(50, "Platform must be at most 50 characters"),
});

export const updateDeviceSchema = z
  .object({
    pushToken: z
      .string()
      .trim()
      .min(1, "Push token is required")
      .max(500, "Push token must be at most 500 characters")
      .optional(),

    platform: z
      .string()
      .trim()
      .min(1, "Platform is required")
      .max(50, "Platform must be at most 50 characters")
      .optional(),
  })
  .refine(
    (data) => data.pushToken !== undefined || data.platform !== undefined,
    {
      message: "At least one field is required",
    },
  );

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
