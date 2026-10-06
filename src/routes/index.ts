import { Router } from "express";

import authRoutes from "./auth.routes.js";
import categoriesRoutes from "./categories.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import paymentsRoutes from "./payments.routes.js";
import subscriptionsRoutes from "./subscriptions.routes.js";
import usersRoutes from "./users.routes.js";
import billingRoutes from "./billing.routes.js";
import devicesRoutes from "./devices.routes.js";
import databaseTestRoutes from "./database-test.routes.js";

import { env } from "../config/env.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "SubFlow API is healthy",
  });
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/categories", categoriesRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/billing", billingRoutes);
router.use("/devices", devicesRoutes);

/**
 * Development/test-only database diagnostics.
 *
 * This route is intentionally NOT mounted in production.
 */
if (env.NODE_ENV !== "production") {
  router.use("/database-test", databaseTestRoutes);
}

export default router;