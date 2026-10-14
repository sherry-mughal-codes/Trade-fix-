"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const orgId = "0f6f951e-01c8-446f-ae5d-cb68074af5ad";
  const userId = "33f97b78-2d2d-4bfd-a14b-e6c28fead63e";
  const arr = ["customers","invoices","payments","journal","reports","hr","inventory","pos"];
  const before = await prisma.organization.findFirst({ where: { id: orgId } });
  console.log("BEFORE org enabledModules:", JSON.stringify(before?.enabledModules), "type:", typeof before?.enabledModules, "Array?", Array.isArray(before?.enabledModules));
  const after = await prisma.organization.update({
    where: { id: orgId },
    data: { enabledModules: arr },
  });
  console.log("UPDATE RETURN:", JSON.stringify(after.enabledModules), "isArray:", Array.isArray(after.enabledModules));
  const chk = await prisma.organization.findUnique({ where: { id: orgId } });
  console.log("DIRECT REFIND:", JSON.stringify(chk.enabledModules), "arr?", Array.isArray(chk.enabledModules));
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId, userId },
    include: { organization: true },
  });
  console.log("MEMBERSHIP.ORG modules:", JSON.stringify(membership?.organization?.enabledModules));
}
main().catch(e => console.error("ERR", e.message)).finally(() => prisma.$disconnect());
