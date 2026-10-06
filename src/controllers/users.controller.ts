import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  changeCurrentUserPassword,
  deleteCurrentUser,
  getCurrentUser,
  updateCurrentUser,
} from "../services/user.service.js";

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(
        new Error(
          "Authenticated user context is missing",
        ),
      );
    }

    const user = await getCurrentUser(
      req.user.userId,
    );

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(
        new Error(
          "Authenticated user context is missing",
        ),
      );
    }

    const user = await updateCurrentUser(
      req.user.userId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message:
        "User profile updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(
        new Error(
          "Authenticated user context is missing",
        ),
      );
    }

    const result =
      await changeCurrentUserPassword(
        req.user.userId,
        req.body.currentPassword,
        req.body.newPassword,
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(
        new Error(
          "Authenticated user context is missing",
        ),
      );
    }

    const result =
      await deleteCurrentUser(
        req.user.userId,
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};