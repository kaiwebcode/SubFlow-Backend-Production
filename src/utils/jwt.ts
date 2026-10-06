import jwt, {
  type JwtPayload,
  type SignOptions,
} from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

const JWT_ALGORITHM = "HS256" as const;

export type AccessTokenPayload = {
  userId: string;
  type: "access";
};

export type RefreshTokenPayload = {
  userId: string;
  tokenId: string;
  type: "refresh";
};

const isValidBasePayload = (
  payload: string | JwtPayload,
): payload is JwtPayload & {
  userId: string;
  type: string;
} => {
  if (typeof payload === "string") {
    return false;
  }

  return (
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    typeof payload.type === "string"
  );
};

export const signAccessToken = (userId: string): string => {
  const payload: AccessTokenPayload = {
    userId,
    type: "access",
  };

  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  };

  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    options,
  );
};

export const signRefreshToken = (
  userId: string,
  tokenId: string,
): string => {
  const payload: RefreshTokenPayload = {
    userId,
    tokenId,
    type: "refresh",
  };

  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  };

  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    options,
  );
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload => {
  try {
    const payload = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET,
      {
        algorithms: [JWT_ALGORITHM],
      },
    );

    if (!isValidBasePayload(payload)) {
      throw new AppError(
        "Invalid access token payload",
        401,
        "INVALID_ACCESS_TOKEN",
      );
    }

    if (payload.type !== "access") {
      throw new AppError(
        "Invalid access token type",
        401,
        "INVALID_ACCESS_TOKEN",
      );
    }

    return {
      userId: payload.userId,
      type: "access",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Invalid or expired access token",
      401,
      "INVALID_ACCESS_TOKEN",
    );
  }
};

export const verifyRefreshToken = (
  token: string,
): RefreshTokenPayload => {
  try {
    const payload = jwt.verify(
      token,
      env.JWT_REFRESH_SECRET,
      {
        algorithms: [JWT_ALGORITHM],
      },
    );

    if (
      !isValidBasePayload(payload) ||
      typeof payload.tokenId !== "string" ||
      payload.tokenId.length === 0
    ) {
      throw new AppError(
        "Invalid refresh token payload",
        401,
        "INVALID_REFRESH_TOKEN",
      );
    }

    if (payload.type !== "refresh") {
      throw new AppError(
        "Invalid refresh token type",
        401,
        "INVALID_REFRESH_TOKEN",
      );
    }

    return {
      userId: payload.userId,
      tokenId: payload.tokenId,
      type: "refresh",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }
};