
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const paymentsPath = path.join(process.cwd(), 'debug_dbs', 'payments_all.json');
  const allocationsPath = path.join(process.cwd(), 'debug_dbs', 'payment_allocations.json');
  
  if (!fs.existsSync(paymentsPath) || !fs.existsSync(allocationsPath)) {
    console.error('JSON files not found in debug_dbs');
    process.exit(1);
  }

  const payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf-8'));
  const allocations = JSON.parse(fs.readFileSync(allocationsPath, 'utf-8'));

  // Get Company Settings for default accounts
  const companySettings = await prisma.companySettings.findFirst();

  // Fetch Accounts
  const receivableAccount = await prisma.account.findUnique({ where: { id: companySettings?.defaultReceivableAccount || '' } });
  
  // Need a default Bank/Cash account if not found.
  const cashAccount = await prisma.account.findFirst({
      where: { name: { contains: 'Cash' } }
  });
  
  // Filter Allocations for ALL invoices
  const targetAllocations = allocations;
  
  if (targetAllocations.length === 0) {
      console.log("No payments found in allocations file.");
      return;
  }

  // Get unique payment IDs (parents)
  const targetPaymentNames: string[] = Array.from(new Set(targetAllocations.map((a: any) => a.parent)));
  
  console.log(`Found ${targetPaymentNames.length} payments to import.`);

  for (const payName of targetPaymentNames) {
      const payData = payments.find((p: any) => p.name === payName);
      if (!payData) {
          console.warn(`Payment data not found for ${payName}`);
          continue;
      }

      // Check if already exists
      const existing = await prisma.payment.findUnique({
          where: { paymentNumber: payName }
      });

      if (existing) {
          console.log(`Payment ${payName} already exists. Skipping.`);
          continue;
      }

      // Get all allocations for this payment (could be multiple invoices)
      const currentAllocations = allocations.filter((a: any) => a.parent === payName);
      
      // Calculate Total Amount in Base Currency (Payment Amount from Source)
      // Source Payment Amount is likely in Base Currency (PKR) or Foreign?
      // Assumption: Source Payment Amount is in Base Currency (or same as Invoice if single).
      // Let's assume Payment Amount in Source is the actual money moved.
      
      const paymentAmount = parseFloat(payData.amount);
      const paymentDate = new Date(payData.date);
      
      // We need to determine the currency of the Payment.
      // If linked invoices are USD, is payment USD?
      // Source DB doesn't have currency on Payment.
      // Strategy: Use Invoice Currency if all allocations are same currency.
      
      // Fetch linked invoices from DB to check currency
      const linkedInvoiceNumbers = currentAllocations.map((a: any) => a.referenceName);
      const dbInvoices = await prisma.invoice.findMany({
          where: { invoiceNumber: { in: linkedInvoiceNumbers } }
      });

      if (dbInvoices.length === 0) {
          console.warn(`No linked invoices found in DB for ${payName}. Skipping.`);
          continue;
      }

      // Check mixed currencies
      const currencies = Array.from(new Set(dbInvoices.map(i => i.currency)));
      let paymentCurrency = 'PKR'; // Default base
      let exchangeRate = 1.0;

      // Logic: If all invoices are USD, assume payment is USD.
      // If any is PKR, assume payment is PKR (and handle conversion if needed, but let's keep simple).
      if (currencies.length === 1 && currencies[0] !== 'PKR') {
          paymentCurrency = currencies[0];
          // Use the first invoice's exchange rate as a proxy
          exchangeRate = dbInvoices[0].exchangeRate;
      }
      
      // Calculate Foreign Amount if currency is not Base
      // Source paymentAmount is ALWAYS in Base Currency (PKR)
      let foreignPaymentAmount = paymentAmount;
      if (paymentCurrency !== 'PKR') {
          foreignPaymentAmount = paymentAmount / exchangeRate;
      }
      
      // Create Payment and Allocations
      try {
        await prisma.$transaction(async (tx) => {
            // 1. Create Payment
            // Note: invoiceId is optional, we skip it as we use allocations now.
            // partyId: use first invoice's party.
            
            const newPayment = await tx.payment.create({
                data: {
                    paymentNumber: payName,
                    date: paymentDate,
                    type: payData.paymentType === 'Receive' ? 'RECEIVE' : 'PAY',
                    method: payData.paymentMethod || 'Cash',
                    reference: payData.referenceId,
                    notes: `Imported from ${payName}`,
                    amount: foreignPaymentAmount, // Store in Payment Currency
                    currency: paymentCurrency,
                    exchangeRate: exchangeRate,
                    partyId: dbInvoices[0].partyId, 
                }
            });

            // 2. Create Allocations & Update Invoices
            let totalAllocated = 0;
            
            for (const alloc of currentAllocations) {
                // Find DB invoice for this allocation
                const inv = dbInvoices.find(i => i.invoiceNumber === alloc.referenceName);
                if (!inv) {
                    console.warn(`Invoice ${alloc.referenceName} not found in DB but allocation exists.`);
                    continue;
                }

                const allocBaseAmount = parseFloat(alloc.amount);
                let allocForeignAmount = allocBaseAmount;
                
                // If Invoice is Foreign, we need to apply the allocation in Foreign Currency
                // Assumption: allocBaseAmount is the PKR value applied.
                if (inv.currency !== 'PKR') {
                    allocForeignAmount = allocBaseAmount / inv.exchangeRate;
                }
                
                totalAllocated += allocForeignAmount;

                // Create Allocation Record
                await tx.paymentAllocation.create({
                    data: {
                        paymentId: newPayment.id,
                        invoiceId: inv.id,
                        amount: allocForeignAmount // Allocation in Invoice Currency (usually same as Payment Currency if matched)
                    }
                });

                // Update Invoice
                const newPaid = inv.paidAmount + allocForeignAmount;
                const newBalance = inv.grandTotal - newPaid;
                let newStatus = inv.status;
                
                // Use tolerance for float comparison
                if (newBalance <= 0.01) newStatus = 'PAID';
                else if (newPaid > 0) newStatus = 'PARTIALLY_PAID';

                await tx.invoice.update({
                    where: { id: inv.id },
                    data: {
                        paidAmount: newPaid,
                        balanceAmount: newBalance,
                        status: newStatus
                    }
                });
            }

            // 3. Create Journal Entry
            // Base Amount = Source Payment Amount (PKR)
            const baseAmount = paymentAmount; 
            
            const jeNumber = `JRN-${payName}`;
            const description = `Payment ${payName} - ${dbInvoices.map(i => i.invoiceNumber).join(', ')}`;
            
            // Debit/Credit Accounts
            // Receive: Debit Cash/Bank, Credit Receivable
            
            const debitAccountId = payData.paymentType === 'Receive' ? cashAccount?.id : receivableAccount?.id;
            const creditAccountId = payData.paymentType === 'Receive' ? receivableAccount?.id : cashAccount?.id;

            if (debitAccountId && creditAccountId) {
                 const je = await tx.journalEntry.create({
                    data: {
                        entryNumber: jeNumber,
                        date: paymentDate,
                        description: description,
                        reference: payName,
                        currency: paymentCurrency,
                        exchangeRate: exchangeRate,
                        rows: {
                            create: [
                                {
                                    accountId: debitAccountId,
                                    debit: baseAmount,
                                    credit: 0,
                                    foreignDebit: foreignPaymentAmount,
                                    foreignCredit: 0,
                                    description: `Payment Received (${paymentCurrency})`
                                },
                                {
                                    accountId: creditAccountId,
                                    debit: 0,
                                    credit: baseAmount,
                                    foreignDebit: 0,
                                    foreignCredit: foreignPaymentAmount,
                                    description: `Customer Payment (${paymentCurrency})`
                                }
                            ]
                        }
                    }
                });
                
                // Link JE to Payment
                await tx.payment.update({
                    where: { id: newPayment.id },
                    data: { journalEntryId: je.id }
                });
            } else {
                console.warn(`Skipping JE for ${payName} due to missing account IDs.`);
            }

        });
        console.log(`Imported Payment: ${payName} (${paymentCurrency} ${foreignPaymentAmount.toFixed(2)}) [Base: ${paymentAmount}]`);

      } catch (e) {
          console.error(`Error importing payment ${payName}:`, e);
      }
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
