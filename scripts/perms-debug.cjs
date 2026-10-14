"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const id = "0f6f951e-01c8-446f-ae5d-cb68074af5ad";
  console.time("t1");
  const u1 = await prisma.organization.findUnique({ where: { id } });
  console.timeEnd("t1");
  console.log("1-FIND (findUnique):          ", JSON.stringify(u1?.enabledModules), "len:", u1?.enabledModules?.length);
  console.time("t2");
  const u2 = await prisma.organization.findFirst({ where: { id } });
  console.timeEnd("t2");
  console.log("2-FIRST (findFirst):          ", JSON.stringify(u2?.enabledModules));
  const u3 = await prisma.organization.findMany({ where: { id } });
  console.log("3-MANY (findMany):            ", JSON.stringify(u3[0]?.enabledModules));
  const u4 = await prisma.organizationMembership.findFirst({
    where: { organizationId: id, userId: "33f97b78-2d2d-4bfd-a14b-e6c28fead63e", isActive: true },
    include: { organization: true },
  });
  console.log("4-MEMBERSHIP.ORG via MEMBER:  ", JSON.stringify(u4?.organization?.enabledModules));
  const u5 = await prisma.$queryRawUnsafe(`SELECT "enabledModules" FROM "Organization" WHERE id=$1`, id);
  console.log("5-RAW SQL:                    ", JSON.stringify(u5));
  const u6 = await prisma.organization.update({
    where: { id },
    data: {
      enabledModules: ["customers","invoices","payments","journal","reports","hr","inventory","pos"],
    },
  });
  console.log("6-AFTER UPDATE:               ", JSON.stringify(u6?.enabledModules));
  const u7 = await prisma.organization.findUnique({ where: { id } });
  console.log("7-FIND AGAIN:                 ", JSON.stringify(u7?.enabledModules));
}
main().catch(e => console.error("ERR:", e.message, e.stack)).finally(() => prisma.$disconnect());
