import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateSubscriptionInput,
  SubscriptionListQuery,
  UpdateSubscriptionInput,
} from "../schemas/subscription.schema.js";

const subscriptionSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  currency: true,
  billingInterval: true,
  billingCount: true,
  startDate: true,
  renewalDate: true,
  status: true,
  logoUrl: true,
  websiteUrl: true,
  reminderEnabled: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
    },
  },
} as const;

const getOwnedSubscription = async (subscriptionId: string, userId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      deletedAt: null,
    },
    select: subscriptionSelect,
  });

  if (!subscription) {
    throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
  }

  return subscription;
};

const ensureCategoryExists = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }
};

export const getSubscriptions = async (
  userId: string,
  query: SubscriptionListQuery,
) => {
  const { status, categoryId, search, page, limit } = query;

  const where = {
    userId,
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(search && {
      name: {
        contains: search,
        mode: "insensitive" as const,
      },
    }),
  };

  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      orderBy: {
        renewalDate: "asc",
      },
      skip: (page - 1) * limit,
      take: limit,
      select: subscriptionSelect,
    }),

    prisma.subscription.count({
      where,
    }),
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createSubscription = async (
  userId: string,
  data: CreateSubscriptionInput,
) => {
  await ensureCategoryExists(data.categoryId);

  if (new Date(data.renewalDate) < new Date(data.startDate)) {
    throw new AppError(
      "Renewal date cannot be before start date",
      400,
      "INVALID_RENEWAL_DATE",
    );
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      billingInterval: data.billingInterval,
      billingCount: data.billingCount,
      startDate: new Date(data.startDate),
      renewalDate: new Date(data.renewalDate),
      status: data.status,
      logoUrl: data.logoUrl,
      websiteUrl: data.websiteUrl,
      reminderEnabled: data.reminderEnabled,
    },
    select: subscriptionSelect,
  });

  return subscription;
};

export const getSubscriptionById = async (
  userId: string,
  subscriptionId: string,
) => {
  return getOwnedSubscription(subscriptionId, userId);
};

export const updateSubscription = async (
  userId: string,
  subscriptionId: string,
  data: UpdateSubscriptionInput,
) => {
  const existing = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      deletedAt: null,
    },
    select: {
      startDate: true,
      renewalDate: true,
    },
  });

  if (!existing) {
    throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
  }

  if (data.categoryId !== undefined) {
    await ensureCategoryExists(data.categoryId);
  }

  const startDate = data.startDate
    ? new Date(data.startDate)
    : existing.startDate;

  const renewalDate = data.renewalDate
    ? new Date(data.renewalDate)
    : existing.renewalDate;

  if (renewalDate < startDate) {
    throw new AppError(
      "Renewal date cannot be before start date",
      400,
      "INVALID_RENEWAL_DATE",
    );
  }

  const result = await prisma.subscription.updateMany({
    where: {
      id: subscriptionId,
      userId,
      deletedAt: null,
    },
    data: {
      ...(data.categoryId !== undefined && {
        categoryId: data.categoryId,
      }),

      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.price !== undefined && {
        price: data.price,
      }),

      ...(data.currency !== undefined && {
        currency: data.currency,
      }),

      ...(data.billingInterval !== undefined && {
        billingInterval: data.billingInterval,
      }),

      ...(data.billingCount !== undefined && {
        billingCount: data.billingCount,
      }),

      ...(data.startDate !== undefined && {
        startDate,
      }),

      ...(data.renewalDate !== undefined && {
        renewalDate,
      }),

      ...(data.logoUrl !== undefined && {
        logoUrl: data.logoUrl,
      }),

      ...(data.websiteUrl !== undefined && {
        websiteUrl: data.websiteUrl,
      }),

      ...(data.reminderEnabled !== undefined && {
        reminderEnabled: data.reminderEnabled,
      }),
    },
  });

  if (result.count === 0) {
    throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
  }

  return getOwnedSubscription(subscriptionId, userId);
};

export const deleteSubscription = async (
  userId: string,
  subscriptionId: string,
) => {
  const result = await prisma.subscription.updateMany({
    where: {
      id: subscriptionId,
      userId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
  }
};

export const updateSubscriptionStatus = async (
  userId: string,
  subscriptionId: string,
  status: "ACTIVE" | "PAUSED" | "CANCELLED",
) => {
  const result = await prisma.subscription.updateMany({
    where: {
      id: subscriptionId,
      userId,
      deletedAt: null,
    },
    data: {
      status,
    },
  });

  if (result.count === 0) {
    throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
  }

  return getOwnedSubscription(subscriptionId, userId);
};
