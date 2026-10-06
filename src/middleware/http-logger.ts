import pinoHttp from "pino-http";

import { logger } from "../config/logger.js";

export const httpLogger = pinoHttp({
  logger,

  /**
   * Never write authentication credentials or other
   * sensitive request data to application logs.
   *
   * This is especially important for:
   * - Bearer access tokens
   * - Cookies
   * - Passwords
   * - Refresh tokens
   * - Clerk tokens
   */
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.refreshToken",
      "req.body.accessToken",
      "req.body.token",
      "req.body.clerkToken",
    ],
    censor: "[REDACTED]",
  },

  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) {
      return "error";
    }

    if (res.statusCode >= 400) {
      return "warn";
    }

    return "info";
  },

  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },

  customErrorMessage: (req, res, error) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${error.message}`;
  },
});