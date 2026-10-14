
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const paymentNumbers = ["PAY-1474", "PAY-1475", "PAY-1482", "PAY-1483"];
  
  // Find the payments first to get their linked invoices
  const payments = await prisma.payment.findMany({
    where: { paymentNumber: { in: paymentNumbers } },
    include: { allocations: true }
  });

  console.log(`Found ${payments.length} payments to cleanup.`);

  for (const payment of payments) {
    await prisma.$transaction(async (tx) => {
      // 1. Reset Invoice paid/balance amounts
      for (const allocation of payment.allocations) {
        const invoice = await tx.invoice.findUnique({ where: { id: allocation.invoiceId } });
        if (invoice) {
          const newPaidAmount = invoice.paidAmount - allocation.amount;
          const newBalanceAmount = invoice.grandTotal - newPaidAmount;
          let newStatus = 'SENT';
          if (newPaidAmount > 0 && newBalanceAmount > 0) newStatus = 'PARTIALLY_PAID';
          
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: newBalanceAmount,
              status: newStatus
            }
          });
          console.log(`Reset Invoice ${invoice.invoiceNumber}: Paid ${newPaidAmount}, Balance ${newBalanceAmount}`);
        }
      }

      // 2. Delete Payment (Allocations and JE will cascade delete if configured, or we delete manually)
      // Based on schema, JournalEntry is not cascade deleted from Payment, but Payment links to it.
      if (payment.journalEntryId) {
          await tx.journalEntry.delete({ where: { id: payment.journalEntryId } });
      }
      
      await tx.payment.delete({ where: { id: payment.id } });
      console.log(`Deleted Payment ${payment.paymentNumber}`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
