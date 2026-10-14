
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.journalEntry.count({
        where: {
            invoice: {
                type: 'PURCHASE'
            }
        }
    });
    console.log(`Journal Entries for Purchase Invoices: ${count}`);
    
    const invoiceCount = await prisma.invoice.count({
        where: { type: 'PURCHASE' }
    });
    console.log(`Total Purchase Invoices: ${invoiceCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
