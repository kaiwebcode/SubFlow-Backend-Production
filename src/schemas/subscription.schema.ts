
import { z } from "zod";

const billingIntervalSchema = z.enum([
  "DAY",
  "WEEK",
  "MONTH",
  "YEAR",
]);

const subscriptionStatusSchema = z.enum([
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
]);

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Currency must be a 3-letter ISO currency code");

const dateSchema = z
  .string()
  .datetime({
    offset: true,
    message: "Date must be a valid ISO 8601 datetime",
  });

/**
 * Create subscription
 */
export const createSubscriptionSchema = z.object({
  categoryId: z
    .string()
    .uuid("Category ID must be a valid UUID"),

  name: z
    .string()
    .trim()
    .min(1, "Subscription name is required")
    .max(150, "Subscription name must not exceed 150 characters"),

  description: z
    .string()
    .trim()
    .max(1000, "Description must not exceed 1000 characters")
    .nullable()
    .optional(),

  price: z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Price must be a valid positive amount with up to 2 decimal places",
    ),

  currency: currencySchema.default("INR"),

  billingInterval: billingIntervalSchema,

  billingCount: z
    .number()
    .int("Billing count must be an integer")
    .positive("Billing count must be greater than 0")
    .max(365, "Billing count must not exceed 365")
    .default(1),

  startDate: dateSchema,

  renewalDate: dateSchema,

  status: subscriptionStatusSchema.default("ACTIVE"),

  logoUrl: z
    .string()
    .trim()
    .url("Logo URL must be a valid URL")
    .max(500, "Logo URL must not exceed 500 characters")
    .nullable()
    .optional(),

  websiteUrl: z
    .string()
    .trim()
    .url("Website URL must be a valid URL")
    .max(500, "Website URL must not exceed 500 characters")
    .nullable()
    .optional(),

  reminderEnabled: z
    .boolean()
    .default(true),
});

/**
 * Update subscription
 *
 * IMPORTANT:
 * Do not derive this from createSubscriptionSchema.
 *
 * Create-time defaults such as:
 * - currency = INR
 * - billingCount = 1
 * - status = ACTIVE
 * - reminderEnabled = true
 *
 * must NOT be applied during PATCH requests.
 */
export const updateSubscriptionSchema = z
  .object({
    categoryId: z
      .string()
      .uuid("Category ID must be a valid UUID")
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, "Subscription name is required")
      .max(150, "Subscription name must not exceed 150 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, "Description must not exceed 1000 characters")
      .nullable()
      .optional(),

    price: z
      .string()
      .trim()
      .regex(
        /^\d+(\.\d{1,2})?$/,
        "Price must be a valid positive amount with up to 2 decimal places",
      )
      .optional(),

    currency: currencySchema.optional(),

    billingInterval: billingIntervalSchema.optional(),

    billingCount: z
      .number()
      .int("Billing count must be an integer")
      .positive("Billing count must be greater than 0")
      .max(365, "Billing count must not exceed 365")
      .optional(),

    startDate: dateSchema.optional(),

    renewalDate: dateSchema.optional(),

    logoUrl: z
      .string()
      .trim()
      .url("Logo URL must be a valid URL")
      .max(500, "Logo URL must not exceed 500 characters")
      .nullable()
      .optional(),

    websiteUrl: z
      .string()
      .trim()
      .url("Website URL must be a valid URL")
      .max(500, "Website URL must not exceed 500 characters")
      .nullable()
      .optional(),

    reminderEnabled: z
      .boolean()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    },
  );

/**
 * Update subscription status
 */
export const updateSubscriptionStatusSchema = z.object({
  status: subscriptionStatusSchema,
});

/**
 * Subscription ID
 */
export const subscriptionIdSchema = z.object({
  id: z.string().uuid("Subscription ID must be a valid UUID"),
});

/**
 * Subscription list query
 */
export const subscriptionListQuerySchema = z.object({
  status: subscriptionStatusSchema.optional(),

  categoryId: z
    .string()
    .uuid("Category ID must be a valid UUID")
    .optional(),

  search: z
    .string()
    .trim()
    .max(100, "Search must not exceed 100 characters")
    .optional(),

  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20),
});

export type CreateSubscriptionInput = z.infer<
  typeof createSubscriptionSchema
>;

export type UpdateSubscriptionInput = z.infer<
  typeof updateSubscriptionSchema
>;

export type SubscriptionListQuery = z.infer<
  typeof subscriptionListQuerySchema
>;

export type SubscriptionIdInput = z.infer<
  typeof subscriptionIdSchema
>;
