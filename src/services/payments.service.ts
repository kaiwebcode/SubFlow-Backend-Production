import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import type { PaymentListQuery } from "../schemas/payment.schema.js";

const paymentSelect = {
  id: true,
  subscriptionId: true,
  amount: true,
  currency: true,
  paidAt: true,
  status: true,
  transactionId: true,
} as const;

export const getPayments = async (
  userId: string,
  query: PaymentListQuery,
) => {
  const { subscriptionId, status, page, limit } = query;

  const where = {
    userId,
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(status ? { status } : {}),
  };

  const skip = (page - 1) * limit;

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: {
        paidAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.payment.count({
      where,
    }),
  ]);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPaymentById = async (
  userId: string,
  paymentId: string,
) => {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      userId,
    },
    select: paymentSelect,
  });

  if (!payment) {
    throw new AppError(
      "Payment not found",
      404,
      "PAYMENT_NOT_FOUND",
    );
  }

  return payment;
};