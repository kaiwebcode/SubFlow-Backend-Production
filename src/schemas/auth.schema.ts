
import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({
      error: "Refresh token is required",
    })
    .min(1, "Refresh token is required"),
});

export const verifyEmailSchema = z.object({
  token: z
    .string({
      error: "Verification token is required",
    })
    .min(1, "Verification token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({
      error: "Password reset token is required",
    })
    .min(1, "Password reset token is required"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

/**
 * Clerk sends a session token from the mobile application.
 *
 * The backend verifies this token using the Clerk Secret Key.
 */
export const clerkExchangeSchema = z.object({
  token: z
    .string({
      error: "Clerk session token is required",
    })
    .trim()
    .min(1, "Clerk session token is required")
    .max(10_000, "Clerk session token is too long"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ClerkExchangeInput = z.infer<typeof clerkExchangeSchema>;
