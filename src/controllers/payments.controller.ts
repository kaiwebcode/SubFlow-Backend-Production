import type { Request, Response, NextFunction } from "express";

import type {
  PaymentIdInput,
  PaymentListQuery,
} from "../schemas/payment.schema.js";

import {
  getPaymentById,
  getPayments,
} from "../services/payments.service.js";

export const getAllPayments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = req.validatedQuery as PaymentListQuery;

    const result = await getPayments(
      req.user!.userId,
      query,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = req.validatedParams as PaymentIdInput;

    const payment = await getPaymentById(
      req.user!.userId,
      params.id,
    );

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};