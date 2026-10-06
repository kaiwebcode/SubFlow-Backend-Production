import type { Request, Response, NextFunction } from "express";

import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification.service.js";

import type { NotificationListQuery } from "../schemas/notification.schema.js";

export async function getNotificationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const query = req.validatedQuery as NotificationListQuery;

    const result = await getNotifications(req.user.userId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadNotificationCountController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const result = await getUnreadNotificationCount(req.user.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsReadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const notification = await markNotificationAsRead(
      req.user.userId,
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: {
        notification,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsReadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const result = await markAllNotificationsAsRead(req.user.userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotificationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    await deleteNotification(
      req.user.userId,
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}