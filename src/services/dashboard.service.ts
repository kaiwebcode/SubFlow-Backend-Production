import { prisma } from "../lib/prisma.js";

const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value);
}

function getMonthlyAmount(
  price: unknown,
  billingInterval: "DAY" | "WEEK" | "MONTH" | "YEAR",
  billingCount: number,
): number {
  const amount = toNumber(price);

  if (billingCount <= 0) {
    return 0;
  }

  switch (billingInterval) {
    case "DAY":
      return amount * (DAYS_PER_MONTH / billingCount);

    case "WEEK":
      return amount * (4.345 / billingCount);

    case "MONTH":
      return amount / billingCount;

    case "YEAR":
      return amount / (MONTHS_PER_YEAR * billingCount);

    default:
      return 0;
  }
}

export async function getDashboard(userId: string) {
  const now = new Date();

  const upcomingLimit = new Date(now);
  upcomingLimit.setDate(upcomingLimit.getDate() + 30);

  const [
    totalSubscriptions,
    activeSubscriptions,
    subscriptions,
    upcomingSubscriptions,
    recentSubscriptions,
    recentPayments,
    billingSubscription,
  ] = await Promise.all([
    prisma.subscription.count({
      where: {
        userId,
        deletedAt: null,
      },
    }),

    prisma.subscription.count({
      where: {
        userId,
        deletedAt: null,
        status: "ACTIVE",
      },
    }),

    prisma.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        price: true,
        billingInterval: true,
        billingCount: true,
        currency: true,
      },
    }),

    prisma.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "ACTIVE",
        renewalDate: {
          gte: now,
          lte: upcomingLimit,
        },
      },
      orderBy: {
        renewalDate: "asc",
      },
      take: 5,
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        billingInterval: true,
        billingCount: true,
        renewalDate: true,
        status: true,
        logoUrl: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    }),

    prisma.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        billingInterval: true,
        billingCount: true,
        renewalDate: true,
        status: true,
        logoUrl: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    }),

    prisma.payment.findMany({
      where: {
        userId,
      },
      orderBy: {
        paidAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        paidAt: true,
        status: true,
        transactionId: true,
        subscription: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    }),

    prisma.billingSubscription.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ]);

  const monthlySpendByCurrency = new Map<string, number>();

  for (const subscription of subscriptions) {
    const monthlyAmount = getMonthlyAmount(
      subscription.price,
      subscription.billingInterval,
      subscription.billingCount,
    );

    const currency = subscription.currency.toUpperCase();

    monthlySpendByCurrency.set(
      currency,
      (monthlySpendByCurrency.get(currency) ?? 0) + monthlyAmount,
    );
  }

  const monthlySpend = Array.from(monthlySpendByCurrency.entries()).map(
    ([currency, amount]) => ({
      currency,
      amount: Number(amount.toFixed(2)),
    }),
  );

  const singleCurrencySpend = monthlySpend[0];

  const primaryCurrency =
    monthlySpend.length === 1 && singleCurrencySpend
      ? singleCurrencySpend.currency
      : null;

  const primaryMonthlySpend =
    monthlySpend.length === 1 && singleCurrencySpend
      ? singleCurrencySpend.amount
      : null;

  return {
    summary: {
      totalSubscriptions,
      activeSubscriptions,
      upcomingPayments: upcomingSubscriptions.length,
      monthlySpend: primaryMonthlySpend,
      currency: primaryCurrency,
      monthlySpendByCurrency: monthlySpend,
    },

    upcomingPayments: upcomingSubscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      price: Number(subscription.price),
      currency: subscription.currency,
      billingInterval: subscription.billingInterval,
      billingCount: subscription.billingCount,
      renewalDate: subscription.renewalDate,
      status: subscription.status,
      logoUrl: subscription.logoUrl,
      category: subscription.category,
    })),

    recentSubscriptions: recentSubscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      price: Number(subscription.price),
      currency: subscription.currency,
      billingInterval: subscription.billingInterval,
      billingCount: subscription.billingCount,
      renewalDate: subscription.renewalDate,
      status: subscription.status,
      logoUrl: subscription.logoUrl,
      createdAt: subscription.createdAt,
      category: subscription.category,
    })),

    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt,
      status: payment.status,
      transactionId: payment.transactionId,
      subscription: payment.subscription,
    })),

    billing: billingSubscription
      ? {
          id: billingSubscription.id,
          plan: billingSubscription.plan,
          status: billingSubscription.status,
          currentPeriodStart: billingSubscription.currentPeriodStart,
          currentPeriodEnd: billingSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: billingSubscription.cancelAtPeriodEnd,
        }
      : null,
  };
}