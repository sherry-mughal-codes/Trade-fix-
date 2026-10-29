
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log(`Updating default layouts for ${orgs.length} organizations...`);

  for (const org of orgs) {
    // 1. Unset all defaults
    await prisma.barcodeLayout.updateMany({
      where: { organizationId: org.id },
      data: { isDefault: false },
    });

    // 2. Check if 3-across preset exists
    let layout3Up = await prisma.barcodeLayout.findFirst({
      where: {
        organizationId: org.id,
        columnsCount: 3,
        paperType: 'ROLL',
      },
    });

    if (!layout3Up) {
      layout3Up = await prisma.barcodeLayout.create({
        data: {
          organizationId: org.id,
          name: 'TSC TTP-244-Pro 3-Across Roll (32x18mm)',
          isDefault: true,
          paperType: 'ROLL',
          widthMm: 32,
          heightMm: 18,
          columnsCount: 3,
          rowsPerPage: 1,
          gapX: 2,
          gapY: 3,
          marginTop: 2,
          marginLeft: 2,
          showCompanyName: true,
          showItemName: true,
          showPrice: true,
          showUnit: true,
          showBarcodeText: true,
          showCategory: false,
          barcodeFormat: 'CODE128',
          barcodeHeight: 3.5,
          fontSize: 9,
          textAlign: 'center',
          currencySymbol: 'Rs.',
          printerName: 'TSC TTP-244 Pro',
        },
      });
      console.log(`Created 3-across preset for org: ${org.name} (${org.id})`);
    } else {
      await prisma.barcodeLayout.update({
        where: { id: layout3Up.id },
        data: {
          name: 'TSC TTP-244-Pro 3-Across Roll (32x18mm)',
          isDefault: true,
          widthMm: 32,
          heightMm: 18,
          gapX: 2,
          gapY: 3,
          marginTop: 2,
          marginLeft: 2,
          barcodeHeight: 3.5,
          textAlign: 'center',
        },
      });
      console.log(`Updated 3-across preset as active default for org: ${org.name}`);
    }
  }

  const allLayouts = await prisma.barcodeLayout.findMany({ where: { isDefault: true } });
  console.log('Active default layouts:');
  for (const l of allLayouts) {
    console.log(`- Org ${l.organizationId}: ${l.name} (${l.widthMm}x${l.heightMm}mm, cols: ${l.columnsCount}, gapX: ${l.gapX}, gapY: ${l.gapY}, ml: ${l.marginLeft})`);
  }
}

main().finally(() => prisma.$disconnect());
