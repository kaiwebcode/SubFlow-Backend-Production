import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

import { logger } from "../config/logger.js";
import { prisma } from "../lib/prisma.js";

const expo = new Expo();

export type SendPushNotificationInput = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification({
  userId,
  title,
  body,
  data,
}: SendPushNotificationInput): Promise<{
  sent: number;
  failed: number;
}> {
  const devices = await prisma.device.findMany({
    where: {
      userId,
      pushToken: {
        not: null,
      },
    },
    select: {
      id: true,
      pushToken: true,
    },
  });

  if (devices.length === 0) {
    logger.info(
      {
        userId,
      },
      "No push-enabled devices found for user",
    );

    return {
      sent: 0,
      failed: 0,
    };
  }

  const messages: ExpoPushMessage[] = [];
  const deviceIds: string[] = [];

  for (const device of devices) {
    if (!device.pushToken) {
      continue;
    }

    if (!Expo.isExpoPushToken(device.pushToken)) {
      logger.warn(
        {
          deviceId: device.id,
        },
        "Invalid Expo push token found",
      );

      continue;
    }

    messages.push({
      to: device.pushToken,
      sound: "default",
      title,
      body,
      data,
    });

    deviceIds.push(device.id);
  }

  if (messages.length === 0) {
    return {
      sent: 0,
      failed: 0,
    };
  }

  const chunks = expo.chunkPushNotifications(messages);

  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] =
        await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          sent += 1;
          return;
        }

        failed += 1;

        logger.error(
          {
            deviceId: deviceIds[index],
            ticket,
          },
          "Expo push notification failed",
        );
      });
    } catch (error) {
      failed += chunk.length;

      logger.error(
        {
          error,
          count: chunk.length,
        },
        "Failed to send Expo push notification chunk",
      );
    }
  }

  return {
    sent,
    failed,
  };
}
