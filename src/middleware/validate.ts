import type {
  Request,
  Response,
  NextFunction,
} from "express";

import type { ZodType } from "zod";

import { AppError } from "../utils/app-error.js";

const getValidationMessage = (error: {
  issues: Array<{ message: string }>;
}) => {
  return error.issues
    .map((issue) => issue.message)
    .join(", ");
};

export const validate = (schema: ZodType) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          getValidationMessage(result.error),
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    req.body = result.data;

    next();
  };
};

export const validateQuery = (schema: ZodType) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(
        new AppError(
          getValidationMessage(result.error),
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    req.validatedQuery = result.data;

    next();
  };
};

export const validateParams = (schema: ZodType) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(
        new AppError(
          getValidationMessage(result.error),
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    req.validatedParams = result.data;

    next();
  };
};