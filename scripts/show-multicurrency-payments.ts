
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({ 
      where: { currency: { not: 'PKR' } },
      include: { 
          allocations: {
              include: { invoice: true }
          }
      }
  });
  
  console.log(`Found ${payments.length} Non-PKR Payments:`);
  
  payments.forEach(p => {
      console.log(`\nPayment: ${p.paymentNumber}`);
      console.log(`Amount: ${p.currency} ${p.amount} (Rate: ${p.exchangeRate})`);
      console.log(`Linked Invoices:`);
      p.allocations.forEach(a => {
          console.log(`- ${a.invoice.invoiceNumber} (Total: ${a.invoice.currency} ${a.invoice.grandTotal}, Paid: ${a.invoice.paidAmount})`);
      });
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
