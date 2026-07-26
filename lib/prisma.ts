import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Vercel kann dieselbe Node.js-Instanz für mehrere Requests wiederverwenden.
// Der Client bleibt deshalb auch in Production global erhalten. Das verhindert
// zusätzliche Pool-Verbindungen und reduziert die Latenz nach dem ersten Request.
globalForPrisma.prisma = prisma;
