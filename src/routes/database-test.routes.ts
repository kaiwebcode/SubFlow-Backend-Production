import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.count();

    res.json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;