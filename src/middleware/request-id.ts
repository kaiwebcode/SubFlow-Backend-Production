import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingRequestId = req.header("x-request-id");

  const id =
    incomingRequestId &&
    REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);

  next();
};