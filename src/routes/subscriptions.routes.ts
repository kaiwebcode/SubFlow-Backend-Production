import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import {
  validate,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";

import {
  createSubscriptionController,
  deleteSubscriptionController,
  getAllSubscriptions,
  getSubscription,
  updateSubscriptionController,
  updateSubscriptionStatusController,
} from "../controllers/subscriptions.controller.js";

import {
  createSubscriptionSchema,
  subscriptionIdSchema,
  subscriptionListQuerySchema,
  updateSubscriptionSchema,
  updateSubscriptionStatusSchema,
} from "../schemas/subscription.schema.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validateQuery(subscriptionListQuerySchema),
  getAllSubscriptions,
);

router.post(
  "/",
  validate(createSubscriptionSchema),
  createSubscriptionController,
);

router.get(
  "/:id",
  validateParams(subscriptionIdSchema),
  getSubscription,
);

router.patch(
  "/:id",
  validateParams(subscriptionIdSchema),
  validate(updateSubscriptionSchema),
  updateSubscriptionController,
);

router.delete(
  "/:id",
  validateParams(subscriptionIdSchema),
  deleteSubscriptionController,
);

router.patch(
  "/:id/status",
  validateParams(subscriptionIdSchema),
  validate(updateSubscriptionStatusSchema),
  updateSubscriptionStatusController,
);

export default router;