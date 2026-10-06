import { Router } from "express";

import { validate } from "../middleware/validate.js";

import {
  clerkExchangeSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../schemas/auth.schema.js";

import {
  clerkExchange,
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  verifyEmail,
} from "../controllers/auth.controller.js";

import { authRateLimit } from "../middleware/rate-limit.js";

const router = Router();

// Rate limit every authentication endpoint.
router.use(authRateLimit);

/**
 * Clerk → SubFlow backend authentication bridge.
 *
 * The mobile app sends its Clerk session token.
 * The backend verifies it and returns the normal
 * SubFlow access + refresh JWT pair.
 */
router.post("/clerk/exchange", validate(clerkExchangeSchema), clerkExchange);

router.post("/register", validate(registerSchema), register);

router.post("/login", validate(loginSchema), login);

router.post("/refresh", validate(refreshTokenSchema), refresh);

router.post("/logout", validate(refreshTokenSchema), logout);

router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
