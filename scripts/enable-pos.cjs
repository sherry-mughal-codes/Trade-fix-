"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: "TradeFix" } });
  if (!org) { console.log("no org"); return; }

  const cur = Array.isArray(org.enabledModules) ? org.enabledModules : [];
  const toAdd = ["inventory", "pos"];
  const next = Array.from(new Set([...cur, ...toAdd]));
  console.log("Before:", cur, "-> After:", next);
  await prisma.organization.update({ where: { id: org.id }, data: { enabledModules: next } });
  console.log("Done.");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
