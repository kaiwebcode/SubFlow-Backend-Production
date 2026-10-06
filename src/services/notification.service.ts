import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import type { NotificationListQuery } from "../schemas/notification.schema.js";

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  readAt: true,
  createdAt: true,
} as const;

export async function getNotifications(
  userId: string,
  query: NotificationListQuery,
) {
  const { unreadOnly, type, page, limit } = query;

  const where = {
    userId,
    ...(unreadOnly && {
      readAt: null,
    }),
    ...(type && {
      type,
    }),
  };

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
      select: notificationSelect,
    }),

    prisma.notification.count({
      where,
    }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const count = await prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });

  return {
    count,
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  if (result.count === 0) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!notification) {
      throw new AppError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND",
      );
    }

    return getNotificationById(userId, notificationId);
  }

  return getNotificationById(userId, notificationId);
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  const result = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (result.count === 0) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }
}

async function getNotificationById(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: notificationSelect,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }

  return notification;
}
