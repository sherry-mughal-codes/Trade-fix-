
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkInvoices() {
  const invoices = await prisma.invoice.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
      journalEntryId: true
    }
  });

  console.log("Recent Invoices:");
  console.table(invoices);

  const settings = await prisma.companySettings.findFirst();
  console.log("Company Settings:", settings);
}

checkInvoices()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
