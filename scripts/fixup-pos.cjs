"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    console.log(`\n--- ${org.name} (${org.id}) ---`);
    const organizationId = org.id;

    const batchByWarehouse = await prisma.itemBatch.groupBy({
      by: ["warehouseName"],
      where: { organizationId, availableQty: { gt: 0 } },
      _sum: { availableQty: true },
    });
    const existingWarehouses = await prisma.inventoryWarehouse.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
    });
    let preferredWarehouseName = "Default Warehouse";
    if (batchByWarehouse.length > 0) {
      const sorted = [...batchByWarehouse].sort(
        (a, b) => Number(b._sum.availableQty || 0) - Number(a._sum.availableQty || 0),
      );
      const top = sorted.find((w) => existingWarehouses.some((ew) => ew.name === w.warehouseName));
      if (top) preferredWarehouseName = top.warehouseName;
    } else if (existingWarehouses.length > 0) {
      preferredWarehouseName = existingWarehouses[0].name;
    }
    if (
      !existingWarehouses.some((w) => w.name === preferredWarehouseName)
    ) {
      await prisma.inventoryWarehouse.upsert({
        where: { organizationId_name: { organizationId, name: preferredWarehouseName } },
        update: { isActive: true },
        create: { organizationId, name: preferredWarehouseName, isActive: true },
      });
      console.log(`  upserted warehouse: ${preferredWarehouseName}`);
    }

    const counter = await prisma.counterMaster.updateMany({
      where: { organizationId, name: "Counter-1" },
      data: { linkedWarehouseName: preferredWarehouseName },
    });
    console.log(`  Counter-1 linkedWarehouseName := ${preferredWarehouseName} (updated ${counter.count})`);

    const defaultPriceList = await prisma.priceList.findFirst({
      where: { organizationId, isActive: true, type: "SELLING" },
      orderBy: [{ isSystemDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    });
    const defaultPriceListId = defaultPriceList?.id || null;
    if (defaultPriceListId) {
      const upd = await prisma.pOSProfile.updateMany({
        where: { organizationId, name: "Default POS Profile" },
        data: { defaultPriceListId },
      });
      console.log(`  Default POS Profile defaultPriceListId := ${defaultPriceList.name} (${defaultPriceListId}) updated ${upd.count}`);
    } else {
      console.log(`  !!! No SELLING price list found for org ${org.name}`);
    }
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
