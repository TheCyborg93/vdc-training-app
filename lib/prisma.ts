import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = prismaGlobal.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}
