import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";

type BodyParserError = Error & {
  type?: string;
  status?: number;
};

const isBodyParserSyntaxError = (
  error: unknown,
): error is BodyParserError => {
  if (!(error instanceof Error)) {
    return false;
  }

  const parserError = error as BodyParserError;

  return (
    parserError.type === "entity.parse.failed" &&
    parserError.status === 400
  );
};

const isPayloadTooLargeError = (
  error: unknown,
): error is BodyParserError => {
  if (!(error instanceof Error)) {
    return false;
  }

  const parserError = error as BodyParserError;

  return (
    parserError.type === "entity.too.large" &&
    parserError.status === 413
  );
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  /**
   * --------------------------------------------------
   * Invalid JSON
   * --------------------------------------------------
   */
  if (isBodyParserSyntaxError(error)) {
    logger.warn(
      {
        code: "INVALID_JSON",
        statusCode: 400,
      },
      "Invalid JSON request body",
    );

    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON request body",
      },
    });

    return;
  }

  /**
   * --------------------------------------------------
   * Payload too large
   * --------------------------------------------------
   */
  if (isPayloadTooLargeError(error)) {
    logger.warn(
      {
        code: "PAYLOAD_TOO_LARGE",
        statusCode: 413,
      },
      "Request payload is too large",
    );

    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload is too large",
      },
    });

    return;
  }

  /**
   * --------------------------------------------------
   * Known application errors
   * --------------------------------------------------
   */
  if (error instanceof AppError) {
    logger.warn(
      {
        code: error.code,
        statusCode: error.statusCode,
      },
      error.message,
    );

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });

    return;
  }

  /**
   * --------------------------------------------------
   * Unexpected errors
   * --------------------------------------------------
   */
  logger.error(
    {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    },
    "Unhandled application error",
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred",
    },
  });
};