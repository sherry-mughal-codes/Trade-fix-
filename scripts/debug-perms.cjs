"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: { email: "test@gmail.com" },
    include: {
      memberships: { include: { organization: true } },
      roles: { include: { role: true } },
    },
  });
  console.log("user id:", u?.id);
  console.log("org memberships:", JSON.stringify(
    (u?.memberships || []).map(m => ({
      org: m.organization?.name,
      orgId: m.organizationId,
      modules: m.organization?.enabledModules,
    })), null, 2));
  console.log("user roles:", JSON.stringify(
    (u?.roles || []).map(r => ({ roleName: r.role?.name, roleId: r.roleId })), null, 2));

  const roleIds = (u?.roles || []).map(r => r.roleId).filter(Boolean);
  const cashierRole = await prisma.role.findFirst({ where: { name: "cashier" } });
  if (cashierRole) roleIds.push(cashierRole.id);
  const adminRole = await prisma.role.findFirst({ where: { name: "admin" } });
  if (adminRole) roleIds.push(adminRole.id);

  const rolesWithPerms = await prisma.role.findMany({
    where: { id: { in: [...new Set(roleIds)] } },
    include: { permissions: { include: { permission: true } } },
  });
  console.log("\nroles with perms:");
  for (const r of rolesWithPerms) {
    console.log(" ", r.name, "->", r.permissions.map(p => p.permission.key));
  }

  const allRoles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });
  console.log("\nall roles:");
  for (const r of allRoles) {
    console.log(" ", r.name, "->", r.permissions.map(p => p.permission.key));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
