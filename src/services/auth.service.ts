import { createHash, randomUUID } from "node:crypto";

import { createClerkClient, verifyToken } from "@clerk/backend";

import { prisma } from "../lib/prisma.js";

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

import { hashPassword, verifyPassword } from "../utils/password.js";

import { AppError } from "../utils/app-error.js";

import type {
  ClerkExchangeInput,
  LoginInput,
  RegisterInput,
} from "../schemas/auth.schema.js";

import {
  generateVerificationToken,
  hashVerificationToken,
} from "../utils/email-verification.js";

import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "../utils/password-reset.js";

import { env } from "../config/env.js";
import { expirationToMilliseconds } from "../utils/token-expiry.js";

const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

/**
 * Create the Clerk backend client.
 *
 * This secret key MUST only exist on the backend.
 * It must never be exposed to the Expo application.
 */
const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

/**
 * Creates a backend authentication session.
 *
 * A session consists of:
 *
 * - short-lived access token
 * - long-lived refresh token
 * - refresh-token family
 *
 * Every new login/session gets its own familyId.
 *
 * Refresh-token rotation keeps the same familyId.
 */
const createBackendSession = async (userId: string) => {
  const refreshTokenId = randomUUID();
  const familyId = randomUUID();

  const accessToken = signAccessToken(userId);

  const refreshToken = signRefreshToken(userId, refreshTokenId);

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const refreshTokenExpiresAt = new Date(
    Date.now() + expirationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId,
      familyId,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Clerk authentication exchange.
 *
 * Flow:
 *
 * Expo
 *   ↓
 * Clerk session token
 *   ↓
 * Backend verifies token
 *   ↓
 * Clerk user
 *   ↓
 * Verify primary email
 *   ↓
 * Local SubFlow user
 *   ↓
 * SubFlow access + refresh JWT
 */
export const exchangeClerkToken = async (input: ClerkExchangeInput) => {
  let clerkPayload: Awaited<ReturnType<typeof verifyToken>>;

  try {
    clerkPayload = await verifyToken(input.token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
  } catch {
    throw new AppError(
      "Invalid or expired Clerk session",
      401,
      "INVALID_CLERK_SESSION",
    );
  }

  const clerkUserId = clerkPayload.sub;

  if (!clerkUserId) {
    throw new AppError("Invalid Clerk session", 401, "INVALID_CLERK_SESSION");
  }

  let clerkUser;

  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch {
    throw new AppError(
      "Unable to retrieve Clerk user",
      401,
      "INVALID_CLERK_USER",
    );
  }

  /**
   * Find the primary Clerk email.
   */
  const primaryEmail = clerkUser.emailAddresses.find(
    (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId,
  );

  /**
   * The backend requires a primary email address.
   */
  if (!primaryEmail?.emailAddress) {
    throw new AppError(
      "Your Clerk account does not have a primary email address",
      400,
      "CLERK_EMAIL_REQUIRED",
    );
  }

  /**
   * IMPORTANT SECURITY CHECK:
   *
   * Having a primary email address is not enough.
   *
   * Clerk must explicitly report that the primary email
   * verification status is "verified".
   *
   * This check happens BEFORE linking an existing local
   * account or creating a new local account.
   */
  if (primaryEmail.verification?.status !== "verified") {
    throw new AppError(
      "Your Clerk email address must be verified before continuing",
      403,
      "CLERK_EMAIL_NOT_VERIFIED",
    );
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();

  const name =
    [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    clerkUser.username ||
    email.split("@")[0] ||
    "SubFlow User";

  const avatarUrl = clerkUser.imageUrl || null;

  /**
   * First try to find the user through clerkId.
   */
  let user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
  });

  /**
   * If this Clerk account has never been connected,
   * try matching an existing local account by email.
   *
   * This prevents duplicate users when someone already
   * has a SubFlow email/password account.
   */
  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      if (user.deletedAt) {
        throw new AppError(
          "User account is not available",
          401,
          "USER_ACCOUNT_INACTIVE",
        );
      }

      user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          clerkId: clerkUserId,
          avatarUrl,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }
  }

  /**
   * No local user exists.
   *
   * Create one.
   *
   * The database currently requires passwordHash.
   * Clerk manages the real authentication password,
   * so we generate an unusable random backend password.
   */
  if (!user) {
    const randomBackendPassword = randomUUID();

    const passwordHash = await hashPassword(randomBackendPassword);

    user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        name,
        email,
        passwordHash,
        avatarUrl,
        emailVerifiedAt: new Date(),
      },
    });
  }

  if (user.deletedAt) {
    throw new AppError(
      "User account is not available",
      401,
      "USER_ACCOUNT_INACTIVE",
    );
  }

  /**
   * Keep profile information synchronized with Clerk.
   *
   * At this point the primary Clerk email has already
   * been confirmed as verified.
   */
  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name,
      avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  /**
   * Creates a fresh backend session with a new
   * refresh-token family.
   */
  const session = await createBackendSession(updatedUser.id);

  return {
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      emailVerifiedAt: updatedUser.emailVerifiedAt,
      createdAt: updatedUser.createdAt,
    },
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
};

export const registerUser = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser && !existingUser.deletedAt) {
    throw new AppError(
      "An account with this email already exists",
      409,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    const verificationToken = generateVerificationToken();

    const verificationTokenHash = hashVerificationToken(verificationToken);

    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: verificationTokenHash,
        expiresAt: verificationTokenExpiresAt,
      },
    });

    /**
     * Create a new refresh-token family
     * for this new session.
     */
    const refreshTokenId = randomUUID();
    const familyId = randomUUID();

    const accessToken = signAccessToken(user.id);

    const refreshToken = signRefreshToken(user.id, refreshTokenId);

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const refreshTokenExpiresAt = new Date(
      Date.now() + expirationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
    );

    await tx.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        familyId,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      user,
      accessToken,
      refreshToken,
      verificationToken,
    };
  });

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      avatarUrl: result.user.avatarUrl,
      emailVerifiedAt: result.user.emailVerifiedAt,
      createdAt: result.user.createdAt,
    },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,

    // Development only.
    verificationToken: result.verificationToken,
  };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);

  if (!passwordValid) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  /**
   * Every new login creates a separate
   * refresh-token family.
   */
  const refreshTokenId = randomUUID();
  const familyId = randomUUID();

  const accessToken = signAccessToken(user.id);

  const refreshToken = signRefreshToken(user.id, refreshTokenId);

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const refreshTokenExpiresAt = new Date(
    Date.now() + expirationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId: user.id,
      familyId,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  if (payload.type !== "refresh") {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashRefreshToken(refreshToken);

  const now = new Date();

  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      id: payload.tokenId,
    },
  });

  if (!storedToken) {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  if (
    storedToken.userId !== payload.userId ||
    storedToken.tokenHash !== tokenHash
  ) {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  /**
   * A revoked refresh token is a possible
   * replay/reuse attack.
   *
   * Revoke the entire refresh-token family.
   */
  if (storedToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: storedToken.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    throw new AppError(
      "Refresh token has already been used",
      401,
      "REFRESH_TOKEN_REUSED",
    );
  }

  /**
   * Expired tokens are invalid, but expiration
   * alone is not treated as token theft.
   */
  if (storedToken.expiresAt <= now) {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.userId,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const newRefreshTokenId = randomUUID();

  const newAccessToken = signAccessToken(user.id);

  const newRefreshToken = signRefreshToken(user.id, newRefreshTokenId);

  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  const newRefreshTokenExpiresAt = new Date(
    Date.now() + expirationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  await prisma.$transaction(async (tx) => {
    /**
     * Atomically revoke the current token.
     *
     * If another request already rotated it,
     * count will be 0.
     */
    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    if (revoked.count !== 1) {
      /**
       * Another request successfully used
       * this token first.
       *
       * Revoke the entire family.
       */
      await tx.refreshToken.updateMany({
        where: {
          familyId: storedToken.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      throw new AppError(
        "Refresh token has already been used",
        401,
        "REFRESH_TOKEN_REUSED",
      );
    }

    /**
     * IMPORTANT:
     *
     * The new refresh token belongs to the
     * SAME family as the previous token.
     */
    await tx.refreshToken.create({
      data: {
        id: newRefreshTokenId,
        userId: user.id,
        familyId: storedToken.familyId,
        tokenHash: newRefreshTokenHash,
        expiresAt: newRefreshTokenExpiresAt,
      },
    });
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    },
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutUser = async (refreshToken: string) => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  if (payload.type !== "refresh") {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashRefreshToken(refreshToken);

  const result = await prisma.refreshToken.updateMany({
    where: {
      id: payload.tokenId,
      userId: payload.userId,
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    throw new AppError(
      "Refresh token is already revoked or invalid",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  return {
    message: "Logged out successfully",
  };
};

export const createEmailVerificationToken = async (userId: string) => {
  const token = generateVerificationToken();

  const tokenHash = hashVerificationToken(token);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
};

export const verifyUserEmail = async (token: string) => {
  const tokenHash = hashVerificationToken(token);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!verificationToken) {
    throw new AppError(
      "Invalid email verification token",
      400,
      "INVALID_VERIFICATION_TOKEN",
    );
  }

  if (verificationToken.usedAt) {
    throw new AppError(
      "Email verification token has already been used",
      400,
      "VERIFICATION_TOKEN_ALREADY_USED",
    );
  }

  const now = new Date();

  if (verificationToken.expiresAt <= now) {
    throw new AppError(
      "Email verification token has expired",
      400,
      "VERIFICATION_TOKEN_EXPIRED",
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: verificationToken.userId,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (user.emailVerifiedAt) {
    throw new AppError(
      "Email is already verified",
      409,
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  await prisma.$transaction(async (tx) => {
    /**
     * Atomically consume the verification token.
     *
     * The usedAt IS NULL condition is critical.
     *
     * If two requests arrive at almost the same time,
     * only one request can update this row.
     */
    const consumedToken = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    if (consumedToken.count !== 1) {
      throw new AppError(
        "Email verification token has already been used or is invalid",
        400,
        "VERIFICATION_TOKEN_ALREADY_USED",
      );
    }

    /**
     * Mark the user's email as verified.
     *
     * emailVerifiedAt IS NULL prevents an already verified
     * account from being changed unnecessarily.
     */
    const verifiedUser = await tx.user.updateMany({
      where: {
        id: user.id,
        emailVerifiedAt: null,
        deletedAt: null,
      },
      data: {
        emailVerifiedAt: now,
      },
    });

    if (verifiedUser.count !== 1) {
      throw new AppError(
        "Email is already verified",
        409,
        "EMAIL_ALREADY_VERIFIED",
      );
    }
  });

  return {
    message: "Email verified successfully",
  };
};

export const createPasswordResetToken = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  /**
   * Don't reveal whether the email exists.
   */
  if (!user || user.deletedAt) {
    return {
      token: null,
    };
  }

  const token = generatePasswordResetToken();

  const tokenHash = hashPasswordResetToken(token);

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  /**
   * Remove previous unused reset tokens.
   */
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
  };
};

export const resetUserPassword = async (token: string, password: string) => {
  const tokenHash = hashPasswordResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!resetToken) {
    throw new AppError(
      "Invalid password reset token",
      400,
      "INVALID_PASSWORD_RESET_TOKEN",
    );
  }

  if (resetToken.usedAt) {
    throw new AppError(
      "Password reset token has already been used",
      400,
      "PASSWORD_RESET_TOKEN_ALREADY_USED",
    );
  }

  const now = new Date();

  if (resetToken.expiresAt <= now) {
    throw new AppError(
      "Password reset token has expired",
      400,
      "PASSWORD_RESET_TOKEN_EXPIRED",
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: resetToken.userId,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  /**
   * Hash the password before opening the transaction.
   *
   * Argon2 is intentionally expensive, so we don't want
   * to keep a database transaction open while hashing.
   */
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    /**
     * Atomically consume the password reset token.
     *
     * Only the first request can change usedAt from NULL
     * to a timestamp.
     */
    const consumedToken = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    if (consumedToken.count !== 1) {
      throw new AppError(
        "Password reset token has already been used or is invalid",
        400,
        "PASSWORD_RESET_TOKEN_ALREADY_USED",
      );
    }

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
      },
    });

    /**
     * Password reset invalidates every
     * existing backend session.
     */
    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });

  return {
    message: "Password reset successfully",
  };
};