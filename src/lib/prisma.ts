import type { PrismaClient as PrismaClientType } from "@prisma/client";

if (process.env.PRISMA_CLIENT_ENGINE_TYPE !== "binary") {
  // Force the binary engine before Prisma Client is loaded.
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

const { PrismaClient } = require("@prisma/client") as {
  PrismaClient: typeof import("@prisma/client").PrismaClient;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
