import { createHash, randomBytes } from "node:crypto";

export const generatePasswordResetToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const hashPasswordResetToken = (
  token: string,
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};