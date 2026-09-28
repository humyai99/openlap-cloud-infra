import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

/** Single Prisma client per process (survives dev hot reload). Prisma parameterizes all queries. */
export const db: PrismaClient =
  g.__prisma ?? (g.__prisma = new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] }));
