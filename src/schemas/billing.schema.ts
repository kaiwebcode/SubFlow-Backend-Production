import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(["PRO_MONTHLY", "PRO_YEARLY"]),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;