import { PrismaClient } from "@prisma/client";

declare const global: { prisma: PrismaClient };

if (!global.prisma) {
  global.prisma = new PrismaClient();
}

export const prisma = global.prisma;
export default global.prisma;
