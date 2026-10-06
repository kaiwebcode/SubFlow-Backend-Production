import { z } from "zod";

const paymentStatusSchema = z.enum([
  "PAID",
  "PENDING",
  "FAILED",
  "REFUNDED",
]);

export const paymentIdSchema = z.object({
  id: z.string().uuid("Payment ID must be a valid UUID"),
});

export const paymentListQuerySchema = z.object({
  subscriptionId: z
    .string()
    .uuid("Subscription ID must be a valid UUID")
    .optional(),

  status: paymentStatusSchema.optional(),

  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export type PaymentIdInput = z.infer<typeof paymentIdSchema>;