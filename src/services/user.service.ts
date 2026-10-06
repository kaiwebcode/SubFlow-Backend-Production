import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import {
  hashPassword,
  verifyPassword,
} from "../utils/password.js";

export const getCurrentUser = async (
  userId: string,
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND",
    );
  }

  const {
    deletedAt: _deletedAt,
    ...safeUser
  } = user;

  return safeUser;
};

export const updateCurrentUser = async (
  userId: string,
  data: {
    name?: string;
    avatarUrl?: string | null;
  },
) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!existingUser || existingUser.deletedAt) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND",
    );
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.avatarUrl !== undefined && {
        avatarUrl: data.avatarUrl,
      }),
    },

    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
};

export const changeCurrentUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      passwordHash: true,
      clerkId: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND",
    );
  }

  /**
   * Clerk owns authentication credentials for Clerk users.
   *
   * The local passwordHash for a Clerk account is only
   * an unusable backend value used to satisfy the schema.
   */
  if (user.clerkId) {
    throw new AppError(
      "Password changes for Clerk accounts must be managed through Clerk",
      400,
      "CLERK_PASSWORD_MANAGED",
    );
  }

  const currentPasswordValid =
    await verifyPassword(
      user.passwordHash,
      currentPassword,
    );

  if (!currentPasswordValid) {
    throw new AppError(
      "Current password is incorrect",
      401,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  const newPasswordHash =
    await hashPassword(newPassword);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id,
      },

      data: {
        passwordHash: newPasswordHash,
      },
    });

    /**
     * Password changes invalidate every existing
     * backend session.
     *
     * The user must authenticate again using
     * the new password.
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
    message:
      "Password changed successfully. Please sign in again.",
  };
};

export const deleteCurrentUser = async (
  userId: string,
) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!existingUser || existingUser.deletedAt) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND",
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    /**
     * Soft-delete the account.
     *
     * We preserve the database record because other
     * entities such as subscriptions, payments,
     * notifications and billing records may reference it.
     */
    await tx.user.update({
      where: {
        id: userId,
      },

      data: {
        deletedAt: now,
      },
    });

    /**
     * Immediately invalidate every backend session.
     */
    await tx.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });
  });

  return {
    message: "User account deleted successfully",
  };
};