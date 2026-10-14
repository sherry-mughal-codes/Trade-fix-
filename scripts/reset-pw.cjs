"use strict";
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("password123", 10);
  console.log("bcrypt hash:", hash);
  await prisma.user.updateMany({ where: { email: "test@gmail.com" }, data: { password: hash } });
  const u = await prisma.user.findFirst({
    where: { email: "test@gmail.com" },
    include: {
      memberships: { include: { role: true, organization: true } },
      roles: true,
    },
  });
  console.log("user:", JSON.stringify({
    id: u?.id,
    email: u?.email,
    memberships: (u?.memberships || []).map(m => ({ org: m.organization.name, role: m.role.name })),
  }, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
