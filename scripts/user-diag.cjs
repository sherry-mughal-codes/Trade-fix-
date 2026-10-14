"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const HASH = "$2a$10$kH5GfIFCEYmLLzm8JHdx2uz4WTyJT3d4IgK7BXCL0bXIrjmnfcrOO";

async function main() {
  const upd = await prisma.user.updateMany({
    where: { email: "test@gmail.com" },
    data: { password: HASH },
  });
  console.log("updated:", upd.count);

  const u = await prisma.user.findFirst({
    where: { email: "test@gmail.com" },
    include: {
      memberships: {
        include: { role: true, organization: true },
      },
      roles: true,
    },
  });
  console.log("memberships:", JSON.stringify(
    (u?.memberships || []).map(m => ({
      org: m.organization?.name,
      role: m.role?.name,
      orgId: m.organizationId,
      roleId: m.roleId,
    })),
    null, 2
  ));
  console.log("roles:", JSON.stringify(u?.roles, null, 2));

  // Also check role permissions for a user assigned to role "cashier"
  const cashierRole = await prisma.role.findFirst({
    where: { name: "cashier" },
    include: { rolePermissions: { include: { permission: true } } },
  });
  console.log("\nCashier role:", JSON.stringify({
    id: cashierRole?.id,
    name: cashierRole?.name,
    perms: cashierRole?.rolePermissions.map(rp => rp.permission.key),
  }, null, 2));

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
