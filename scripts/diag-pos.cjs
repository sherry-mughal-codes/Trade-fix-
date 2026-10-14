"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    console.log(`\n===== ORG: ${org.name} =====`);
    const items = await prisma.item.findMany({
      where: { organizationId: org.id, isActive: true },
      take: 5,
      select: { id: true, name: true, itemCode: true, itemType: true, stockOnHand: true },
    });
    console.log("Item sample (first 5 active):", JSON.stringify(items, null, 2));

    const counts = {
      totalActive: await prisma.item.count({ where: { organizationId: org.id, isActive: true } }),
      invActive: await prisma.item.count({ where: { organizationId: org.id, isActive: true, itemType: "INVENTORY" } }),
    };
    console.log("Counts:", JSON.stringify(counts));

    const warehouses = await prisma.inventoryWarehouse.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, isActive: true },
    });
    console.log("InventoryWarehouses:", JSON.stringify(warehouses, null, 2));

    const counters = await prisma.counterMaster.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, linkedWarehouseName: true, isActive: true },
    });
    console.log("CounterMaster:", JSON.stringify(counters, null, 2));

    const profiles = await prisma.pOSProfile.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        hideOutOfStockItems: true,
        defaultPriceListId: true,
        posCounter: { select: { id: true, name: true, linkedWarehouseName: true } },
      },
    });
    console.log("POSProfiles:", JSON.stringify(profiles, null, 2));

    const batchSample = await prisma.itemBatch.groupBy({
      by: ["warehouseName"],
      where: { organizationId: org.id, availableQty: { gt: 0 } },
      _count: { _all: true },
      _sum: { availableQty: true },
    });
    console.log("itemBatch by warehouse (qty>0):", JSON.stringify(batchSample, null, 2));

    const priceLists = await prisma.priceList.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, type: true, isSystemDefault: true },
    });
    console.log("PriceLists:", JSON.stringify(priceLists, null, 2));

    const priceCountByList = await prisma.priceListItem.groupBy({
      by: ["priceListId"],
      where: { organizationId: org.id },
      _count: { _all: true },
    });
    console.log("PriceListItem counts per list:", JSON.stringify(priceCountByList, null, 2));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
