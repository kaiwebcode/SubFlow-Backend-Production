import { createHash, randomBytes } from "node:crypto";

export const generateVerificationToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const hashVerificationToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};