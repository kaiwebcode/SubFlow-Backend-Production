import { prisma } from "../lib/prisma.js";

export const getCategories = async () => {
  return prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};