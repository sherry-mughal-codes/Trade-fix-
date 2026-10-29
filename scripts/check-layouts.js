const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const layouts = await prisma.barcodeLayout.findMany();
  console.log('Layouts count:', layouts.length);
  for (const l of layouts) {
    console.log(`- ${l.name} (default: ${l.isDefault}, ${l.widthMm}x${l.heightMm}mm, cols: ${l.columnsCount})`);
  }
}

main().finally(() => prisma.$disconnect());

