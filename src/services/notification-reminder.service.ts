import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../lib/prisma.js";
import { sendPushNotification } from "./push-notification.service.js";

export async function createSubscriptionRenewalReminders(): Promise<{
  checked: number;
  created: number;
  pushSent: number;
  pushFailed: number;
}> {
  const now = new Date();

  const reminderLimit = new Date(now);

  reminderLimit.setDate(
    reminderLimit.getDate() +
      env.NOTIFICATION_REMINDER_DAYS,
  );

  const subscriptions =
    await prisma.subscription.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        reminderEnabled: true,
        renewalDate: {
          gte: now,
          lte: reminderLimit,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        renewalDate: true,
      },
    });

  let created = 0;
  let pushSent = 0;
  let pushFailed = 0;

  for (const subscription of subscriptions) {
    const reminderWindowStart = new Date(
      subscription.renewalDate.getTime() -
        env.NOTIFICATION_REMINDER_DAYS *
          24 *
          60 *
          60 *
          1000,
    );

    const existingNotification =
      await prisma.notification.findFirst({
        where: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          type: "BILLING_REMINDER",
          createdAt: {
            gte: reminderWindowStart,
          },
        },
        select: {
          id: true,
        },
      });

    if (existingNotification) {
      continue;
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (subscription.renewalDate.getTime() -
          now.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );

    const message =
      daysRemaining === 0
        ? `Your ${subscription.name} subscription renews today.`
        : daysRemaining === 1
          ? `Your ${subscription.name} subscription renews tomorrow.`
          : `Your ${subscription.name} subscription renews in ${daysRemaining} days.`;

    await prisma.notification.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        type: "BILLING_REMINDER",
        title: `${subscription.name} Renewal Reminder`,
        message,
      },
    });

    created += 1;

    try {
      const pushResult =
        await sendPushNotification({
          userId: subscription.userId,
          title: `${subscription.name} Renewal Reminder`,
          body: message,
          data: {
            type: "BILLING_REMINDER",
            subscriptionId: subscription.id,
          },
        });

      pushSent += pushResult.sent;
      pushFailed += pushResult.failed;

      logger.info(
        {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          sent: pushResult.sent,
          failed: pushResult.failed,
        },
        "Renewal reminder push notification processed",
      );
    } catch (error) {
      logger.error(
        {
          error,
          subscriptionId: subscription.id,
          userId: subscription.userId,
        },
        "Failed to send renewal reminder push notification",
      );
    }
  }

  return {
    checked: subscriptions.length,
    created,
    pushSent,
    pushFailed,
  };
}
