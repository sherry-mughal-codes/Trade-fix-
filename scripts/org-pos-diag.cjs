"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "test@gmail.com" } });
  console.log("User id:", user?.id);

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user?.id, isActive: true },
  });
  for (const m of memberships) {
    const org = await prisma.organization.findUnique({ where: { id: m.organizationId } });
    console.log("\n=== Org:", org?.name, "id:", org?.id, "owner?", m.isOwner);
    console.log("enabledModules:", org?.enabledModules);

    const userRoles = await prisma.userRole.findMany({ where: { userId: user?.id }, include: { role: true } });
    for (const ur of userRoles.filter(r => r.role.organizationId === org?.id)) {
      const permRows = await prisma.rolePermission.findMany({
        where: { roleId: ur.roleId, allowed: true },
        include: { permission: true },
      });
      console.log("  Role:", ur.role.name, " perms:", permRows.map(p => p.permission.key).sort());
    }

    console.log("\n  CounterMasters:", await prisma.counterMaster.findMany({ where: { organizationId: org.id } }));
    console.log("\n  POSProfiles:", await prisma.pOSProfile.findMany({ where: { organizationId: org.id } }));

    console.log("\n  Items count total, INVENTORY active:",
      (await prisma.item.count({ where: { organizationId: org.id, isActive: true } })),
      (await prisma.item.count({ where: { organizationId: org.id, isActive: true, itemType: "INVENTORY" } }))
    );
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
