import dotenv from "dotenv";
import { z } from "zod";
import type { StringValue } from "ms";

const nodeEnv = process.env.NODE_ENV ?? "development";

const envFiles: Record<"development" | "test" | "production", string> = {
  development: ".env.development.local",
  test: ".env.test.local",
  production: ".env.production.local",
};

const envFile = envFiles[nodeEnv as keyof typeof envFiles];

if (envFile) {
  dotenv.config({
    path: envFile,
  });
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(8000),

    HOST: z.string().trim().min(1).default("localhost"),

    API_PREFIX: z.string().trim().min(1).default("/api/v1"),

    CORS_ORIGIN: z.string().trim().min(1),

    DATABASE_URL: z.string().trim().min(1),

    JWT_ACCESS_SECRET: z.string().min(64),

    JWT_REFRESH_SECRET: z.string().min(64),

    JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1).default("15m"),

    JWT_REFRESH_EXPIRES_IN: z.string().trim().min(1).default("30d"),

    /**
     * Backend-only Clerk secret.
     * Never expose this to the Expo application.
     */
    CLERK_SECRET_KEY: z.string().trim().min(1),

    STRIPE_SECRET_KEY: z.string().trim().min(1),

    STRIPE_WEBHOOK_SECRET: z.string().trim().min(1),

    STRIPE_SUCCESS_URL: z.string().url(),

    STRIPE_CANCEL_URL: z.string().url(),

    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().trim().min(1),

    STRIPE_PRO_YEARLY_PRICE_ID: z.string().trim().min(1),

    NOTIFICATION_REMINDER_DAYS: z.coerce.number().int().min(0).default(1),

    NOTIFICATION_REMINDER_CRON: z.string().trim().min(1).default("0 9 * * *"),
  })
  .superRefine((data, ctx) => {
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT access and refresh secrets must be different",
      });
    }

    if (
      data.NODE_ENV === "production" &&
      data.CORS_ORIGIN === "http://localhost:8081"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message:
          "CORS_ORIGIN must not use the localhost development origin in production",
      });
    }
  });

const result = envSchema.safeParse({
  ...process.env,
  NODE_ENV: nodeEnv,
});

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = {
  ...result.data,

  JWT_ACCESS_EXPIRES_IN: result.data.JWT_ACCESS_EXPIRES_IN as StringValue,

  JWT_REFRESH_EXPIRES_IN: result.data.JWT_REFRESH_EXPIRES_IN as StringValue,
};
