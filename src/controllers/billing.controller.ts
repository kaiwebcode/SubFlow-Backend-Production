import type { NextFunction, Request, Response } from "express";

import Stripe from "stripe";

import { env } from "../config/env.js";
import { stripe } from "../lib/stripe.js";

import {
  createCheckoutSession,
  getBillingSubscription,
  getStripeWebhookEvent,
  markBillingSubscriptionCanceled,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
  syncBillingInvoice,
  syncStripeSubscription,
} from "../services/billing.service.js";

import type { CreateCheckoutSessionInput } from "../schemas/billing.schema.js";

import { AppError } from "../utils/app-error.js";

/**
 * Minimal Stripe subscription shape required
 * by our billing synchronization service.
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

/**
 * POST /billing/checkout
 */
export const createCheckoutSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    const input = req.body as CreateCheckoutSessionInput;

    const checkout = await createCheckoutSession(
      req.user.userId,
      req.user.email,
      input,
    );

    res.status(201).json({
      success: true,
      data: checkout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /billing/me
 */
export const getMyBillingController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    const subscription = await getBillingSubscription(req.user.userId);

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /billing/webhook
 */
export const stripeWebhookController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let eventId: string | undefined;
  let eventType: string | undefined;

  try {
    const signature = req.header("stripe-signature");

    if (!signature) {
      throw new AppError(
        "Missing Stripe signature",
        400,
        "STRIPE_SIGNATURE_MISSING",
      );
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(
        "Invalid Stripe webhook body",
        400,
        "INVALID_STRIPE_WEBHOOK_BODY",
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      console.error(
        "[Stripe webhook verification]",
        error instanceof Error ? error.message : "Unknown verification error",
      );

      throw new AppError(
        "Invalid Stripe webhook signature",
        400,
        "INVALID_STRIPE_WEBHOOK_SIGNATURE",
      );
    }

    eventId = event.id;
    eventType = event.type;

    /**
     * Idempotency protection.
     */
    const existingEvent = await getStripeWebhookEvent(event.id);

    if (existingEvent?.processedAt) {
      res.status(200).json({
        received: true,
        duplicate: true,
      });

      return;
    }

    /**
     * Process Stripe event.
     */
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") {
          break;
        }

        if (!session.subscription) {
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ["items.data.price"],
          },
        );

        const stripeSubscription =
          subscription as unknown as StripeSubscriptionPayload;

        await syncStripeSubscription(stripeSubscription);

        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data
          .object as unknown as StripeSubscriptionPayload;

        await syncStripeSubscription(subscription);

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data
          .object as unknown as StripeSubscriptionPayload;

        await syncStripeSubscription(subscription);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as {
          id: string;
        };

        await markBillingSubscriptionCanceled(subscription.id);

        break;
      }

      /**
       * Successful recurring invoice payment.
       */
      case "invoice.paid": {
        const invoice = event.data.object as unknown as Parameters<
          typeof syncBillingInvoice
        >[0];

        await syncBillingInvoice(invoice, true);

        break;
      }

      /**
       * Failed recurring invoice payment.
       */
      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as Parameters<
          typeof syncBillingInvoice
        >[0];

        await syncBillingInvoice(invoice, false);

        break;
      }

      default:
        break;
    }

    /**
     * Only mark the event as processed
     * after successful handling.
     */
    await markStripeWebhookEventProcessed(event.id, event.type);

    res.status(200).json({
      received: true,
      duplicate: false,
    });
  } catch (error) {
    /**
     * Keep failed events retryable.
     */
    if (eventId && eventType) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown webhook error";

      try {
        await markStripeWebhookEventFailed(eventId, eventType, errorMessage);
      } catch {
        /**
         * Preserve the original webhook error.
         */
      }
    }

    next(error);
  }
};
