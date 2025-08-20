import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

const connect = async () => {
  await prisma.$connect();
  return prisma;
};

export { connect };
