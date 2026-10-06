import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

import {
  changePassword,
  deleteMe,
  getMe,
  updateMe,
} from "../controllers/users.controller.js";

import {
  changePasswordSchema,
  updateCurrentUserSchema,
} from "../schemas/user.schema.js";

const router = Router();

router.use(authenticate);

router.get(
  "/me",
  getMe,
);

router.patch(
  "/me",
  validate(updateCurrentUserSchema),
  updateMe,
);

router.patch(
  "/me/password",
  validate(changePasswordSchema),
  changePassword,
);

router.delete(
  "/me",
  deleteMe,
);

export default router;