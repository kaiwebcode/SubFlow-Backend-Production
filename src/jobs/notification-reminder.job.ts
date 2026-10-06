import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createSubscriptionRenewalReminders } from "../services/notification-reminder.service.js";

let reminderJob: ScheduledTask | null = null;

export function startNotificationReminderJob(): void {
  if (reminderJob) {
    logger.warn(
      "Notification reminder job is already running.",
    );

    return;
  }

  if (!cron.validate(env.NOTIFICATION_REMINDER_CRON)) {
    throw new Error(
      `Invalid notification reminder cron expression: ${env.NOTIFICATION_REMINDER_CRON}`,
    );
  }

  reminderJob = cron.schedule(
    env.NOTIFICATION_REMINDER_CRON,
    async () => {
      logger.info(
        "Notification reminder job started.",
      );

      try {
        const result =
          await createSubscriptionRenewalReminders();

        logger.info(
          {
            checked: result.checked,
            created: result.created,
            pushSent: result.pushSent,
            pushFailed: result.pushFailed,
          },
          "Notification reminder job completed.",
        );
      } catch (error) {
        logger.error(
          { error },
          "Notification reminder job failed.",
        );
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  logger.info(
    {
      schedule: env.NOTIFICATION_REMINDER_CRON,
      timezone: "Asia/Kolkata",
    },
    "Notification reminder job scheduled.",
  );
}

export function stopNotificationReminderJob(): void {
  if (!reminderJob) {
    return;
  }

  reminderJob.stop();
  reminderJob = null;

  logger.info(
    "Notification reminder job stopped.",
  );
}
