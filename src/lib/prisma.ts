// @ts-nocheck
// Force the binary engine before Prisma Client is loaded.
process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
process.env.PRISMA_ENGINE_TYPE = "binary";
process.env.PRISMA_QUERY_ENGINE_TYPE = "binary";

const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
