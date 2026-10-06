import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./lib/prisma.js";
import {
  startNotificationReminderJob,
  stopNotificationReminderJob,
} from "./jobs/notification-reminder.job.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const HTTP_REQUEST_TIMEOUT_MS = 120_000;
const HTTP_HEADERS_TIMEOUT_MS = 60_000;
const HTTP_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const HTTP_SOCKET_TIMEOUT_MS = 120_000;

const startServer = async () => {
  try {
    await prisma.$connect();

    logger.info("Database connected successfully");

    startNotificationReminderJob();

    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`SubFlow Backend running at http://${env.HOST}:${env.PORT}`);

      logger.info(
        {
          requestTimeoutMs: HTTP_REQUEST_TIMEOUT_MS,
          headersTimeoutMs: HTTP_HEADERS_TIMEOUT_MS,
          keepAliveTimeoutMs: HTTP_KEEP_ALIVE_TIMEOUT_MS,
          socketTimeoutMs: HTTP_SOCKET_TIMEOUT_MS,
        },
        "HTTP server timeouts configured",
      );
    });

    server.requestTimeout = HTTP_REQUEST_TIMEOUT_MS;
    server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;
    server.keepAliveTimeout = HTTP_KEEP_ALIVE_TIMEOUT_MS;
    server.setTimeout(HTTP_SOCKET_TIMEOUT_MS);

    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn({ signal }, "Shutdown already in progress");

        return;
      }

      isShuttingDown = true;

      logger.info({ signal }, "Shutting down server...");

      stopNotificationReminderJob();

      const shutdownTimeout = setTimeout(() => {
        logger.error(
          {
            timeoutMs: SHUTDOWN_TIMEOUT_MS,
          },
          "Graceful shutdown timed out. Forcing process exit.",
        );

        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      shutdownTimeout.unref();

      server.close(async (error) => {
        try {
          if (error) {
            logger.error({ error }, "Failed to close HTTP server cleanly");

            clearTimeout(shutdownTimeout);

            await prisma.$disconnect();

            process.exit(1);
          }

          await prisma.$disconnect();

          clearTimeout(shutdownTimeout);

          logger.info("Database connection closed.");
          logger.info("Server closed.");

          process.exit(0);
        } catch (disconnectError) {
          clearTimeout(shutdownTimeout);

          logger.error(
            { error: disconnectError },
            "Failed during shutdown cleanup",
          );

          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      logger.error(
        { error: disconnectError },
        "Failed to disconnect database after startup failure",
      );
    }

    process.exit(1);
  }
};

void startServer();
