import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import { validateParams, validateQuery } from "../middleware/validate.js";

import {
  getAllPayments,
  getPayment,
} from "../controllers/payments.controller.js";

import {
  paymentIdSchema,
  paymentListQuerySchema,
} from "../schemas/payment.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", validateQuery(paymentListQuerySchema), getAllPayments);

router.get("/:id", validateParams(paymentIdSchema), getPayment);

export default router;
