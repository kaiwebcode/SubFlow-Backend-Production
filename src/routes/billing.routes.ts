import { Router } from "express";



import { authenticate } from "../middleware/auth.middleware.js";

import { validate } from "../middleware/validate.js";

import {
  createCheckoutSessionSchema,
} from "../schemas/billing.schema.js";
import { createCheckoutSessionController, getMyBillingController, stripeWebhookController } from "../controllers/billing.controller.js";

const router = Router();

/**
 * Stripe webhook
 *
 * IMPORTANT:
 * This route must NOT use authenticate middleware.
 *
 * Stripe authenticates itself using the
 * stripe-signature header.
 */
router.post(
  "/webhook",
  stripeWebhookController,
);

/**
 * Create SubFlow Pro checkout session.
 */
router.post(
  "/checkout",
  authenticate,
  validate(createCheckoutSessionSchema),
  createCheckoutSessionController,
);

/**
 * Get current user's SubFlow billing status.
 */
router.get(
  "/me",
  authenticate,
  getMyBillingController,
);

export default router;