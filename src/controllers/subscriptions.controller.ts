import type { Request, Response, NextFunction } from "express";

import {
  createSubscription,
  deleteSubscription,
  getSubscriptionById,
  getSubscriptions,
  updateSubscription,
  updateSubscriptionStatus,
} from "../services/subscription.service.js";
import { SubscriptionListQuery } from "../schemas/subscription.schema.js";

export const getAllSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const query = req.validatedQuery as SubscriptionListQuery;

    const result = await getSubscriptions(req.user.userId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const subscription = await createSubscription(req.user.userId, req.body);

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const subscription = await getSubscriptionById(
      req.user.userId,
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      data: {
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const subscription = await updateSubscription(
      req.user.userId,
      req.params.id as string,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: {
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    await deleteSubscription(req.user.userId, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Authenticated user context is missing"));
    }

    const subscription = await updateSubscriptionStatus(
      req.user.userId,
      req.params.id as string,
      req.body.status,
    );

    res.status(200).json({
      success: true,
      message: "Subscription status updated successfully",
      data: {
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};
