import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.development.local",
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const categories = [
  {
    name: "Entertainment",
    slug: "entertainment",
    icon: "play-circle",
  },
  {
    name: "AI Tools",
    slug: "ai-tools",
    icon: "sparkles",
  },
  {
    name: "Developer Tools",
    slug: "developer-tools",
    icon: "code",
  },
  {
    name: "Design",
    slug: "design",
    icon: "palette",
  },
  {
    name: "Productivity",
    slug: "productivity",
    icon: "check-circle",
  },
  {
    name: "Cloud",
    slug: "cloud",
    icon: "cloud",
  },
  {
    name: "Music",
    slug: "music",
    icon: "music",
  },
  {
    name: "Other",
    slug: "other",
    icon: "grid",
  },
];

const main = async () => {
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
        icon: category.icon,
      },
      create: category,
    });
  }

  console.log(`Seeded ${categories.length} categories.`);
};

main()
  .catch((error) => {
    console.error("Category seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });