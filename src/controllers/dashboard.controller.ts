import type { Request, Response } from "express";

import { getDashboard } from "../services/dashboard.service.js";

export async function getDashboardController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });

      return;
    }

    const dashboard = await getDashboard(req.user.userId);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    throw error;
  }
}
