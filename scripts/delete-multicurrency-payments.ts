
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({ 
      where: { currency: { not: 'PKR' } },
      include: { allocations: true }
  });
  
  console.log(`Deleting ${payments.length} Non-PKR Payments...`);
  
  for (const payment of payments) {
    await prisma.$transaction(async (tx) => {
      // 1. Reset Invoice paid/balance amounts
      for (const allocation of payment.allocations) {
        const invoice = await tx.invoice.findUnique({ where: { id: allocation.invoiceId } });
        if (invoice) {
          const newPaidAmount = invoice.paidAmount - allocation.amount;
          const newBalanceAmount = invoice.grandTotal - newPaidAmount;
          let newStatus = 'SENT';
          if (newPaidAmount > 0.01 && newBalanceAmount > 0.01) newStatus = 'PARTIALLY_PAID';
          else if (newBalanceAmount <= 0.01) newStatus = 'PAID';
          
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

      // 2. Delete Journal Entry
      if (payment.journalEntryId) {
          await tx.journalEntry.delete({ where: { id: payment.journalEntryId } });
      }
      
      // 3. Delete Payment
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
