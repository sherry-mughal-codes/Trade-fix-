import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to clear data in production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const before = await prisma.$transaction([
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.journalEntry.count(),
    prisma.party.count(),
    prisma.employee.count(),
    prisma.currency.count(),
    prisma.item.count(),
  ]);

  console.log("Counts before:", {
    invoices: before[0],
    payments: before[1],
    journalEntries: before[2],
    parties: before[3],
    employees: before[4],
    currencies: before[5],
    items: before[6],
  });

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany(),
    prisma.paymentAllocation.deleteMany(),

    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),

    prisma.journalRow.deleteMany(),
    prisma.salaryPayment.deleteMany(),
    prisma.salarySlip.deleteMany(),
    prisma.journalEntry.deleteMany(),

    prisma.employee.deleteMany(),
    prisma.party.deleteMany(),
    prisma.currency.deleteMany(),
    prisma.item.deleteMany(),
  ]);

  const after = await prisma.$transaction([
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.journalEntry.count(),
    prisma.party.count(),
    prisma.employee.count(),
    prisma.currency.count(),
    prisma.item.count(),
  ]);

  console.log("Counts after:", {
    invoices: after[0],
    payments: after[1],
    journalEntries: after[2],
    parties: after[3],
    employees: after[4],
    currencies: after[5],
    items: after[6],
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

