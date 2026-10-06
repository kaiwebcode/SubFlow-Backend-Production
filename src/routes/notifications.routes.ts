import { Router } from "express";

import {
  deleteNotificationController,
  getNotificationsController,
  getUnreadNotificationCountController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
} from "../controllers/notification.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import {
  validateParams,
  validateQuery,
} from "../middleware/validate.js";

import {
  notificationIdSchema,
  notificationListQuerySchema,
} from "../schemas/notification.schema.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validateQuery(notificationListQuerySchema),
  getNotificationsController,
);

router.get(
  "/unread-count",
  getUnreadNotificationCountController,
);

router.patch(
  "/read-all",
  markAllNotificationsAsReadController,
);

router.patch(
  "/:id/read",
  validateParams(notificationIdSchema),
  markNotificationAsReadController,
);

router.delete(
  "/:id",
  validateParams(notificationIdSchema),
  deleteNotificationController,
);

export default router;