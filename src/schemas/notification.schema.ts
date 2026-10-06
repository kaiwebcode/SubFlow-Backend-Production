import { z } from "zod";

export const notificationIdSchema = z.object({
  id: z.uuid("Invalid notification ID"),
});

export const notificationListQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((value) => value === "true"),

  type: z
    .enum([
      "BILLING_REMINDER",
      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
      "GENERAL",
    ])
    .optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type NotificationListQuery = z.infer<
  typeof notificationListQuerySchema
>;