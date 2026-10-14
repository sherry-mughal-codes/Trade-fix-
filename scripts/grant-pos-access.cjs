"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const orgId = "0f6f951e-01c8-446f-ae5d-cb68074af5ad";
  const userId = "33f97b78-2d2d-4bfd-a14b-e6c28fead63e";

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      enabledModules: ["customers", "invoices", "payments", "journal", "reports", "hr", "inventory", "pos"],
    },
  });
  console.log("org modules updated:", JSON.stringify(org.enabledModules));

  const adminRole = await prisma.role.findFirst({
    where: { organizationId: orgId, name: "admin" },
    include: { permissions: { include: { permission: true } } },
  });
  console.log("admin id:", adminRole?.id, "perms:", adminRole?.permissions.length);
  const adminHas = new Set(adminRole?.permissions.map(p => p.permission.key));
  const keys = [
    "pos.access",
    "pos.counter.open",
    "pos.sale.create",
    "pos.sale.saveOrder",
    "pos.sale.checkout",
    "pos.sale.clearCart",
    "pos.sale.creditCheckout",
    "pos.sale.discount",
    "pos.sale.voidLine",
    "pos.sale.priceOverride",
    "pos.sale.discountOverride",
    "pos.shift.openSelf",
    "pos.shift.closeSelf",
    "pos.customer.quickCreate",
    "inventory.access",
    "dashboard.access",
  ];
  let added = 0;
  for (const key of keys) {
    if (adminHas.has(key)) continue;
    const perm = await prisma.permission.findFirst({ where: { key } });
    if (!perm) {
      console.log("missing perm definition:", key);
      continue;
    }
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: perm.id },
    });
    console.log("added to admin:", key);
    added++;
  }
  console.log("total added:", added);

  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId, userId },
  });
  console.log("membership id:", membership?.id);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
