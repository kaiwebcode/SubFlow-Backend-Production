import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";

import type { CreateCheckoutSessionInput } from "../schemas/billing.schema.js";

import { AppError } from "../utils/app-error.js";

/**
 * ------------------------------------------------------------
 * TYPES
 * ------------------------------------------------------------
 */

type StripeSubscriptionPayload = {
  id: string;

  customer:
    | string
    | {
        id: string;
      };

  status: string;

  cancel_at_period_end: boolean;

  current_period_start?: number | null;

  current_period_end?: number | null;

  items: {
    data: Array<{
      price: {
        id: string;
      };

      current_period_start?: number | null;

      current_period_end?: number | null;
    }>;
  };

  metadata: Record<string, string>;
};

type StripeInvoicePayload = {
  id: string;

  customer:
    | string
    | {
        id: string;
      };

  subscription?:
    | string
    | {
        id: string;
      }
    | null;

  payment_intent?:
    | string
    | {
        id: string;
      }
    | null;

  amount_due: number;

  amount_paid: number;

  currency: string;

  hosted_invoice_url?: string | null;

  invoice_pdf?: string | null;

  status?: string | null;

  created: number;

  due_date?: number | null;

  period_start?: number | null;

  period_end?: number | null;

  status_transitions?: {
    paid_at?: number | null;
  } | null;

  metadata?: Record<string, string>;

  parent?: {
    subscription_details?: {
      subscription?: string | null;

      metadata?: Record<string, string>;
    } | null;
  } | null;
};

/**
 * ------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------
 */

/**
 * Convert Stripe Unix timestamp to Date.
 */
const stripeTimestampToDate = (
  timestamp?: number | null,
): Date | null => {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000);
};

/**
 * Extract Stripe customer ID.
 */
const getStripeCustomerId = (
  customer:
    | string
    | {
        id: string;
      },
): string => {
  return typeof customer === "string"
    ? customer
    : customer.id;
};

/**
 * Extract Stripe subscription ID.
 */
const getStripeSubscriptionId = (
  subscription?:
    | string
    | {
        id: string;
      }
    | null,
): string | null => {
  if (!subscription) {
    return null;
  }

  return typeof subscription === "string"
    ? subscription
    : subscription.id;
};

/**
 * Extract Stripe payment intent ID.
 */
const getStripePaymentIntentId = (
  paymentIntent?:
    | string
    | {
        id: string;
      }
    | null,
): string | null => {
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent.id;
};

/**
 * Convert Stripe amount from the smallest currency unit
 * into the Decimal-compatible string used by Prisma.
 *
 * Example:
 *
 * 499900 -> "4999.00"
 */
const stripeAmountToDecimal = (
  amount: number,
): string => {
  return (amount / 100).toFixed(2);
};

/**
 * Convert Stripe status to our Prisma billing status.
 */
const getBillingSubscriptionStatus = (
  status: string,
) => {
  switch (status) {
    case "incomplete":
      return "INCOMPLETE" as const;

    case "active":
      return "ACTIVE" as const;

    case "past_due":
      return "PAST_DUE" as const;

    case "canceled":
      return "CANCELED" as const;

    case "unpaid":
      return "UNPAID" as const;

    case "trialing":
      return "TRIALING" as const;

    default:
      return "INCOMPLETE" as const;
  }
};

/**
 * Convert Stripe invoice status into our Prisma status.
 */
const getBillingInvoiceStatus = (
  status: string | null | undefined,
  paid: boolean,
) => {
  if (paid) {
    return "PAID" as const;
  }

  switch (status) {
    case "open":
      return "OPEN" as const;

    case "void":
      return "VOID" as const;

    case "uncollectible":
      return "UNCOLLECTIBLE" as const;

    default:
      return "FAILED" as const;
  }
};

/**
 * Resolve our internal plan from a Stripe Price ID.
 */
const getPlanFromPriceId = (
  priceId: string,
) => {
  if (
    priceId ===
    env.STRIPE_PRO_MONTHLY_PRICE_ID
  ) {
    return "PRO_MONTHLY";
  }

  if (
    priceId ===
    env.STRIPE_PRO_YEARLY_PRICE_ID
  ) {
    return "PRO_YEARLY";
  }

  throw new AppError(
    "Unknown Stripe price",
    400,
    "UNKNOWN_STRIPE_PRICE",
  );
};

/**
 * Resolve Stripe Price ID from our internal plan.
 */
const getPriceId = (
  plan: CreateCheckoutSessionInput["plan"],
) => {
  switch (plan) {
    case "PRO_MONTHLY":
      return env.STRIPE_PRO_MONTHLY_PRICE_ID;

    case "PRO_YEARLY":
      return env.STRIPE_PRO_YEARLY_PRICE_ID;
  }
};

/**
 * ------------------------------------------------------------
 * CHECKOUT
 * ------------------------------------------------------------
 */

/**
 * Create a Stripe Checkout Session.
 *
 * Important:
 *
 * subscription_data.metadata contains the SubFlow user ID.
 *
 * This metadata is later used by webhook reconciliation when
 * Stripe sends invoice.paid before customer.subscription.created.
 */
export const createCheckoutSession = async (
  userId: string,
  email: string,
  input: CreateCheckoutSessionInput,
) => {
  const priceId = getPriceId(input.plan);

  const session =
    await stripe.checkout.sessions.create({
      mode: "subscription",

      customer_email: email,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      metadata: {
        userId,
        plan: input.plan,
      },

      subscription_data: {
        metadata: {
          userId,
          plan: input.plan,
        },
      },

      success_url: env.STRIPE_SUCCESS_URL,

      cancel_url: env.STRIPE_CANCEL_URL,
    });

  if (!session.id || !session.url) {
    throw new AppError(
      "Unable to create Stripe checkout session",
      500,
      "STRIPE_CHECKOUT_FAILED",
    );
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
};

/**
 * ------------------------------------------------------------
 * BILLING SUBSCRIPTION SYNC
 * ------------------------------------------------------------
 */

/**
 * Synchronize a Stripe subscription into our database.
 *
 * This function is intentionally idempotent.
 *
 * It can safely be called from:
 *
 * - customer.subscription.created
 * - customer.subscription.updated
 * - checkout.session.completed
 * - invoice.paid reconciliation
 */
export const syncBillingSubscription = async ({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  plan,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: string;
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
}) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(
      "User account is not available",
      404,
      "USER_NOT_FOUND",
    );
  }

  /**
   * Create or update the Stripe customer mapping.
   */
  const billingCustomer =
    await prisma.billingCustomer.upsert({
      where: {
        userId,
      },

      create: {
        userId,
        stripeCustomerId,
      },

      update: {
        stripeCustomerId,
      },
    });

  /**
   * Create or update the local billing subscription.
   */
  const billingSubscription =
    await prisma.billingSubscription.upsert({
      where: {
        userId,
      },

      create: {
        userId,
        billingCustomerId:
          billingCustomer.id,
        stripeSubscriptionId,
        stripePriceId,
        plan,
        status:
          getBillingSubscriptionStatus(status),
        currentPeriodStart:
          currentPeriodStart ?? null,
        currentPeriodEnd:
          currentPeriodEnd ?? null,
        cancelAtPeriodEnd,
      },

      update: {
        billingCustomerId:
          billingCustomer.id,
        stripeSubscriptionId,
        stripePriceId,
        plan,
        status:
          getBillingSubscriptionStatus(status),
        currentPeriodStart:
          currentPeriodStart ?? null,
        currentPeriodEnd:
          currentPeriodEnd ?? null,
        cancelAtPeriodEnd,
      },
    });

  return billingSubscription;
};

/**
 * ------------------------------------------------------------
 * STRIPE SUBSCRIPTION SYNC
 * ------------------------------------------------------------
 */

/**
 * Synchronize a Stripe subscription payload.
 *
 * This is the central Stripe subscription reconciliation function.
 */
export const syncStripeSubscription = async (
  subscription: StripeSubscriptionPayload,
) => {
  const stripeCustomerId =
    getStripeCustomerId(subscription.customer);

  const firstItem =
    subscription.items.data[0];

  if (!firstItem?.price?.id) {
    throw new AppError(
      "Stripe subscription does not contain a price",
      400,
      "STRIPE_PRICE_MISSING",
    );
  }

  const stripePriceId =
    firstItem.price.id;

  const plan =
    getPlanFromPriceId(stripePriceId);

  const userId =
    subscription.metadata?.userId;

  if (!userId) {
    throw new AppError(
      "Stripe subscription is missing SubFlow user metadata",
      400,
      "STRIPE_USER_METADATA_MISSING",
    );
  }

  return syncBillingSubscription({
    userId,

    stripeCustomerId,

    stripeSubscriptionId:
      subscription.id,

    stripePriceId,

    plan,

    status:
      subscription.status,

    currentPeriodStart:
      stripeTimestampToDate(
        subscription.current_period_start ??
          firstItem.current_period_start,
      ),

    currentPeriodEnd:
      stripeTimestampToDate(
        subscription.current_period_end ??
          firstItem.current_period_end,
      ),

    cancelAtPeriodEnd:
      subscription.cancel_at_period_end,
  });
};

/**
 * ------------------------------------------------------------
 * BILLING SUBSCRIPTION LOOKUP
 * ------------------------------------------------------------
 */

/**
 * Get the current user's billing subscription.
 */
export const getBillingSubscription = async (
  userId: string,
) => {
  return prisma.billingSubscription.findUnique({
    where: {
      userId,
    },

    select: {
      id: true,
      plan: true,
      status: true,
      stripePriceId: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * ------------------------------------------------------------
 * STRIPE SUBSCRIPTION CANCELLATION
 * ------------------------------------------------------------
 */

/**
 * Mark a local billing subscription as cancelled.
 */
export const markBillingSubscriptionCanceled =
  async (
    stripeSubscriptionId: string,
  ) => {
    return prisma.billingSubscription.updateMany({
      where: {
        stripeSubscriptionId,
      },

      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
      },
    });
  };

/**
 * ------------------------------------------------------------
 * WEBHOOK EVENT PERSISTENCE
 * ------------------------------------------------------------
 */

/**
 * Get a previously received Stripe webhook event.
 */
export const getStripeWebhookEvent = async (
  eventId: string,
) => {
  return prisma.stripeWebhookEvent.findUnique({
    where: {
      eventId,
    },
  });
};

/**
 * Mark a Stripe webhook event as successfully processed.
 */
export const markStripeWebhookEventProcessed =
  async (
    eventId: string,
    eventType: string,
  ) => {
    return prisma.stripeWebhookEvent.upsert({
      where: {
        eventId,
      },

      create: {
        eventId,
        eventType,
        processedAt: new Date(),
        failedAt: null,
        error: null,
      },

      update: {
        eventType,
        processedAt: new Date(),
        failedAt: null,
        error: null,
      },
    });
  };

/**
 * Mark a Stripe webhook event as failed.
 *
 * We intentionally keep processedAt NULL so Stripe can retry it.
 */
export const markStripeWebhookEventFailed =
  async (
    eventId: string,
    eventType: string,
    error: string,
  ) => {
    return prisma.stripeWebhookEvent.upsert({
      where: {
        eventId,
      },

      create: {
        eventId,
        eventType,
        processedAt: null,
        failedAt: new Date(),
        error,
      },

      update: {
        eventType,
        processedAt: null,
        failedAt: new Date(),
        error,
      },
    });
  };

/**
 * ------------------------------------------------------------
 * INVOICE RECONCILIATION
 * ------------------------------------------------------------
 */

/**
 * Ensure that the BillingCustomer and BillingSubscription
 * exist before processing an invoice.
 *
 * Stripe does NOT guarantee webhook ordering.
 *
 * Therefore invoice.paid can arrive before:
 *
 * - customer.subscription.created
 * - checkout.session.completed
 *
 * When that happens, we retrieve the Stripe subscription
 * directly and synchronize it first.
 */
const ensureBillingContextForInvoice =
  async (
    invoice: StripeInvoicePayload,
  ) => {
    const stripeCustomerId =
      getStripeCustomerId(invoice.customer);

    /**
     * First try the normal local lookup.
     */
    const existingCustomer =
      await prisma.billingCustomer.findUnique({
        where: {
          stripeCustomerId,
        },
      });

    if (existingCustomer) {
      return existingCustomer;
    }

    /**
     * No local customer yet.
     *
     * Try to resolve the Stripe subscription.
     */
    const stripeSubscriptionId =
      getStripeSubscriptionId(
        invoice.subscription,
      ) ??
      invoice.parent?.subscription_details
        ?.subscription ??
      null;

    if (!stripeSubscriptionId) {
      throw new AppError(
        `Billing customer not found for Stripe customer ${stripeCustomerId} and invoice has no subscription`,
        500,
        "BILLING_CUSTOMER_NOT_FOUND",
      );
    }

    /**
     * Retrieve the actual Stripe subscription.
     *
     * This is the key part of the webhook-ordering fix.
     */
    const stripeSubscription =
      await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        {
          expand: ["items.data.price"],
        },
      );

    const subscription =
      stripeSubscription as unknown as StripeSubscriptionPayload;

    /**
     * The subscription created by SubFlow contains
     * trusted metadata:
     *
     * {
     *   userId: "...",
     *   plan: "PRO_MONTHLY"
     * }
     */
    const userId =
      subscription.metadata?.userId ??
      invoice.parent?.subscription_details
        ?.metadata?.userId ??
      invoice.metadata?.userId;

    if (!userId) {
      throw new AppError(
        `Stripe subscription ${stripeSubscriptionId} is missing SubFlow user metadata`,
        500,
        "STRIPE_USER_METADATA_MISSING",
      );
    }

    /**
     * Synchronize the customer + subscription before
     * attempting to create the invoice record.
     */
    await syncStripeSubscription({
      ...subscription,

      metadata: {
        ...subscription.metadata,
        userId,
      },
    });

    const synchronizedCustomer =
      await prisma.billingCustomer.findUnique({
        where: {
          stripeCustomerId,
        },
      });

    if (!synchronizedCustomer) {
      throw new AppError(
        `Unable to synchronize BillingCustomer for Stripe customer ${stripeCustomerId}`,
        500,
        "BILLING_CUSTOMER_SYNC_FAILED",
      );
    }

    return synchronizedCustomer;
  };

/**
 * ------------------------------------------------------------
 * INVOICE SYNC
 * ------------------------------------------------------------
 */

/**
 * Synchronize a Stripe invoice.
 *
 * This function is now safe against Stripe webhook ordering.
 */
export const syncBillingInvoice = async (
  invoice: StripeInvoicePayload,
  paid: boolean,
) => {
  const stripeCustomerId =
    getStripeCustomerId(invoice.customer);

  /**
   * IMPORTANT:
   *
   * This call makes invoice processing resilient when
   * invoice.paid arrives before subscription.created.
   */
  const billingCustomer =
    await ensureBillingContextForInvoice(
      invoice,
    );

  const stripeSubscriptionId =
    getStripeSubscriptionId(
      invoice.subscription,
    ) ??
    invoice.parent?.subscription_details
      ?.subscription ??
    null;

  /**
   * Find the local subscription using the Stripe
   * subscription ID when available.
   */
  let billingSubscription =
    stripeSubscriptionId
      ? await prisma.billingSubscription.findUnique(
          {
            where: {
              stripeSubscriptionId,
            },
          },
        )
      : null;

  /**
   * If the invoice still isn't associated with a
   * local subscription, use the customer's current
   * billing subscription as a fallback.
   */
  if (!billingSubscription) {
    billingSubscription =
      await prisma.billingSubscription.findUnique(
        {
          where: {
            billingCustomerId:
              billingCustomer.id,
          },
        },
      );
  }

  /**
   * An invoice belonging to a SubFlow subscription
   * should always have a local subscription after
   * ensureBillingContextForInvoice().
   */
  if (!billingSubscription) {
    throw new AppError(
      `Billing subscription not found for Stripe customer ${stripeCustomerId}`,
      500,
      "BILLING_SUBSCRIPTION_NOT_FOUND",
    );
  }

  const amountDue =
    stripeAmountToDecimal(
      invoice.amount_due,
    );

  const amountPaid =
    stripeAmountToDecimal(
      invoice.amount_paid,
    );

  const paidAt =
    paid
      ? stripeTimestampToDate(
          invoice.status_transitions
            ?.paid_at,
        ) ?? new Date()
      : null;

  const status =
    getBillingInvoiceStatus(
      invoice.status,
      paid,
    );

  const billingInvoice =
    await prisma.billingInvoice.upsert({
      where: {
        stripeInvoiceId: invoice.id,
      },

      create: {
        userId:
          billingSubscription.userId,

        billingCustomerId:
          billingCustomer.id,

        billingSubscriptionId:
          billingSubscription.id,

        stripeInvoiceId:
          invoice.id,

        stripeCustomerId,

        stripeSubscriptionId,

        stripePaymentIntentId:
          getStripePaymentIntentId(
            invoice.payment_intent,
          ),

        amountDue,

        amountPaid,

        currency:
          invoice.currency.toUpperCase(),

        status,

        hostedInvoiceUrl:
          invoice.hosted_invoice_url ??
          null,

        invoicePdf:
          invoice.invoice_pdf ??
          null,

        paidAt,

        dueDate:
          stripeTimestampToDate(
            invoice.due_date,
          ),

        periodStart:
          stripeTimestampToDate(
            invoice.period_start,
          ),

        periodEnd:
          stripeTimestampToDate(
            invoice.period_end,
          ),
      },

      update: {
        userId:
          billingSubscription.userId,

        billingCustomerId:
          billingCustomer.id,

        billingSubscriptionId:
          billingSubscription.id,

        stripeCustomerId,

        stripeSubscriptionId,

        stripePaymentIntentId:
          getStripePaymentIntentId(
            invoice.payment_intent,
          ),

        amountDue,

        amountPaid,

        currency:
          invoice.currency.toUpperCase(),

        status,

        hostedInvoiceUrl:
          invoice.hosted_invoice_url ??
          null,

        invoicePdf:
          invoice.invoice_pdf ??
          null,

        paidAt,

        dueDate:
          stripeTimestampToDate(
            invoice.due_date,
          ),

        periodStart:
          stripeTimestampToDate(
            invoice.period_start,
          ),

        periodEnd:
          stripeTimestampToDate(
            invoice.period_end,
          ),
      },
    });

  /**
   * Keep the local subscription status synchronized
   * with the successful/failed invoice payment.
   */
  await prisma.billingSubscription.update({
    where: {
      id: billingSubscription.id,
    },

    data: {
      status: paid
        ? "ACTIVE"
        : "PAST_DUE",
    },
  });

  return billingInvoice;
};
