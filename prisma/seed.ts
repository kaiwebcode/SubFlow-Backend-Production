import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV ?? "development";

const envFiles: Record<"development" | "test" | "production", string> = {
  development: ".env.development.local",
  test: ".env.test.local",
  production: ".env.production.local",
};

const envFile = envFiles[nodeEnv as keyof typeof envFiles];

if (envFile) {
  dotenv.config({
    path: envFile,
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(`DATABASE_URL is not defined for NODE_ENV=${nodeEnv}`);
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
