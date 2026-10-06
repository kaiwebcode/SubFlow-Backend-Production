import { Router } from "express";

import {
  createDeviceController,
  deleteDeviceController,
  getDevicesController,
  updateDeviceController,
} from "../controllers/devices.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import {
  validate,
  validateParams,
} from "../middleware/validate.js";

import {
  createDeviceSchema,
  deviceIdSchema,
  updateDeviceSchema,
} from "../schemas/device.schema.js";

const router = Router();

/**
 * All device routes require authentication.
 */
router.use(authenticate);

/**
 * Register or update a user's device.
 */
router.post(
  "/",
  validate(createDeviceSchema),
  createDeviceController,
);

/**
 * Get all devices belonging to the authenticated user.
 */
router.get(
  "/",
  getDevicesController,
);

/**
 * Update a registered device.
 */
router.patch(
  "/:id",
  validateParams(deviceIdSchema),
  validate(updateDeviceSchema),
  updateDeviceController,
);

/**
 * Remove a registered device.
 */
router.delete(
  "/:id",
  validateParams(deviceIdSchema),
  deleteDeviceController,
);

export default router;
