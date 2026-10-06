import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import router from "./routes/index.js";

import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { httpLogger } from "./middleware/http-logger.js";
import { apiRateLimit } from "./middleware/rate-limit.js";

const app = express();

app.set("trust proxy", 1);

/**
 * --------------------------------------------------
 * Global middleware
 * --------------------------------------------------
 */

app.use(requestId);
app.use(httpLogger);
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

/**
 * --------------------------------------------------
 * Stripe webhook
 * --------------------------------------------------
 *
 * IMPORTANT:
 * Stripe signature verification requires the ORIGINAL
 * request body as a Buffer.
 *
 * This MUST be registered BEFORE express.json().
 */
app.use(
  `${env.API_PREFIX}/billing/webhook`,
  express.raw({
    type: "application/json",
  }),
);

/**
 * --------------------------------------------------
 * Normal JSON body parser
 * --------------------------------------------------
 *
 * This comes AFTER the Stripe raw-body middleware.
 */
app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

/**
 * --------------------------------------------------
 * API routes
 * --------------------------------------------------
 */
app.use(
  env.API_PREFIX,
  apiRateLimit,
  router,
);

/**
 * --------------------------------------------------
 * Root route
 * --------------------------------------------------
 */
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message:
      "Welcome to the SubFlow Backend Server It is Created by Kaif Qureshi!!",
    environment: env.NODE_ENV,
  });
});

/**
 * --------------------------------------------------
 * Error handling
 * --------------------------------------------------
 */
app.use(notFound);
app.use(errorHandler);

export default app;