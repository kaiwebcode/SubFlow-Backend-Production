import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const nodeEnv =
  process.env.NODE_ENV ?? "development";

const envFiles: Record<
  "development" | "test" | "production",
  string
> = {
  development: ".env.development.local",
  test: ".env.test.local",
  production: ".env.production.local",
};

const envFile =
  envFiles[
    nodeEnv as keyof typeof envFiles
  ];

if (envFile) {
  dotenv.config({
    path: envFile,
  });
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: env("DATABASE_URL"),
  },
});