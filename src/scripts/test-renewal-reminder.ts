import "../config/env.js";

import { prisma } from "../lib/prisma.js";
import { createSubscriptionRenewalReminders } from "../services/notification-reminder.service.js";

async function main(): Promise<void> {
  try {
    const result =
      await createSubscriptionRenewalReminders();

    console.log("");
    console.log("======================================");
    console.log("Renewal Reminder Test");
    console.log("======================================");
    console.log("");
    console.log(
      "Checked subscriptions:",
      result.checked,
    );
    console.log(
      "Notifications created:",
      result.created,
    );
    console.log(
      "Push notifications sent:",
      result.pushSent,
    );
    console.log(
      "Push notifications failed:",
      result.pushFailed,
    );
    console.log("");
  } catch (error) {
    console.error("");
    console.error(
      "Renewal reminder test failed:",
    );
    console.error(error);
    console.error("");

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(
    "Unexpected test error:",
    error,
  );

  await prisma.$disconnect();

  process.exitCode = 1;
});
