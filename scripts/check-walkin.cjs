"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: "TradeFix" } });
  console.log("org id:", org?.id);

  const walkinIdFromProfile = "256a5f18-f022-4ffb-90e9-fa49a8699195";
  const party = await prisma.party.findUnique({ where: { id: walkinIdFromProfile } });
  console.log("Walkin party by id:", JSON.stringify(party, null, 2));

  const walkins = await prisma.party.findMany({
    where: { organizationId: org.id, name: { contains: "walk-in", mode: "insensitive" } },
  });
  console.log("\nAll Walk-in parties:", JSON.stringify(walkins, null, 2));

  // Now check savedOrder params to see possible customerId values
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
