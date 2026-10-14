
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Helper to parse CSV line
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

async function main() {
    const transactionsDir = path.join(process.cwd(), '../extracted_data/transactions');
    const paymentFile = path.join(transactionsDir, 'Payment.csv');
    const paymentForFile = path.join(transactionsDir, 'PaymentFor.csv');

    if (!fs.existsSync(paymentFile) || !fs.existsSync(paymentForFile)) {
        console.error('CSV files not found in extracted_data/transactions');
        process.exit(1);
    }

    // Read files
    console.log('Reading CSV files...');
    const paymentContent = fs.readFileSync(paymentFile, 'utf-8');
    const paymentForContent = fs.readFileSync(paymentForFile, 'utf-8');

    const paymentLines = paymentContent.split('\n').filter(l => l.trim());
    const paymentForLines = paymentForContent.split('\n').filter(l => l.trim());

    // Parse Headers
    const paymentHeaders = parseCSVLine(paymentLines[0]);
    const paymentForHeaders = parseCSVLine(paymentForLines[0]);

    // Parse Data
    const payments = paymentLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        paymentHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    const paymentFor = paymentForLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        paymentForHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    // Filter Allocations only for PurchaseInvoice
    const purchaseAllocations = paymentFor.filter(a => a.referenceType === 'PurchaseInvoice');
    
    // Group Allocations by Parent Payment
    const allocationsByPayment: Record<string, any[]> = {};
    purchaseAllocations.forEach(a => {
        if (!allocationsByPayment[a.parent]) {
            allocationsByPayment[a.parent] = [];
        }
        allocationsByPayment[a.parent].push(a);
    });

    // Get Payment IDs that have PurchaseInvoice allocations
    const targetPaymentIds = Object.keys(allocationsByPayment);

    console.log(`Found ${targetPaymentIds.length} payments linked to Purchase Invoices.`);

    // Get Accounts
    const companySettings = await prisma.companySettings.findFirst();
    const payableAccount = await prisma.account.findUnique({ 
        where: { id: companySettings?.defaultPayableAccount || '' } 
    });
    
    // Default Cash Account
    const cashAccount = await prisma.account.findFirst({
        where: { name: { contains: 'Cash' } }
    });

    if (!payableAccount || !cashAccount) {
        console.warn("Warning: Default Payable or Cash account not found. Journal Entries might be skipped.");
    }

    for (const payId of targetPaymentIds) {
        const payData = payments.find(p => p.name === payId);
        if (!payData) {
            console.warn(`Payment header not found for ${payId}`);
            continue;
        }

        try {
            // Check if exists
            const existing = await prisma.payment.findUnique({
                where: { paymentNumber: payData.name }
            });

            if (existing) {
                console.log(`Payment ${payData.name} already exists. Skipping.`);
                continue;
            }

            const allocations = allocationsByPayment[payId];
            
            // Validate Invoices exist
            const invoiceNumbers = allocations.map(a => a.referenceName);
            const dbInvoices = await prisma.invoice.findMany({
                where: { invoiceNumber: { in: invoiceNumbers } }
            });

            if (dbInvoices.length === 0) {
                console.warn(`No linked invoices found for ${payId}. Skipping.`);
                continue;
            }

            // Determine Currency & Party from first invoice
            const firstInv = dbInvoices[0];
            const currency = firstInv.currency;
            const exchangeRate = firstInv.exchangeRate;
            const partyId = firstInv.partyId;

            // Transaction
            await prisma.$transaction(async (tx) => {
                // 1. Create Payment
                const newPayment = await tx.payment.create({
                    data: {
                        paymentNumber: payData.name,
                        date: new Date(payData.date),
                        type: payData.paymentType === 'Receive' ? 'RECEIVE' : 'PAY',
                        method: payData.paymentMethod || 'Cash',
                        reference: payData.referenceId,
                        notes: `Imported Purchase Payment ${payData.name}`,
                        amount: parseFloat(payData.amount),
                        currency: currency,
                        exchangeRate: exchangeRate,
                        partyId: partyId,
                        // invoiceId: dbInvoices.length === 1 ? dbInvoices[0].id : undefined // Optional
                    }
                });

                // 2. Process Allocations & Update Invoices
                let totalAllocated = 0;
                for (const alloc of allocations) {
                    const inv = dbInvoices.find(i => i.invoiceNumber === alloc.referenceName);
                    if (!inv) continue;

                    const amount = parseFloat(alloc.amount);
                    totalAllocated += amount;

                    // Create Allocation
                    await tx.paymentAllocation.create({
                        data: {
                            paymentId: newPayment.id,
                            invoiceId: inv.id,
                            amount: amount
                        }
                    });

                    // Update Invoice Status
                    const newPaid = inv.paidAmount + amount;
                    const newBalance = inv.grandTotal - newPaid;
                    let newStatus = inv.status;
                    
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
                // PAY (Purchase) -> Debit Payable, Credit Cash/Bank
                const jeNumber = `JRN-${payData.name}`;
                const baseAmount = parseFloat(payData.amount) * exchangeRate; // Approx if rate > 1

                if (payableAccount && cashAccount) {
                    const je = await tx.journalEntry.create({
                        data: {
                            entryNumber: jeNumber,
                            date: new Date(payData.date),
                            description: `Payment to ${payData.party}`,
                            reference: payData.name,
                            currency: currency,
                            exchangeRate: exchangeRate,
                            rows: {
                                create: [
                                    {
                                        accountId: payableAccount.id,
                                        debit: baseAmount,
                                        credit: 0,
                                        foreignDebit: parseFloat(payData.amount),
                                        foreignCredit: 0,
                                        description: `Payment to Vendor`
                                    },
                                    {
                                        accountId: cashAccount.id,
                                        debit: 0,
                                        credit: baseAmount,
                                        foreignDebit: 0,
                                        foreignCredit: parseFloat(payData.amount),
                                        description: `Cash Out`
                                    }
                                ]
                            }
                        }
                    });

                    // Link JE
                    await tx.payment.update({
                        where: { id: newPayment.id },
                        data: { journalEntryId: je.id }
                    });
                }
            });

            console.log(`Imported Payment: ${payData.name}`);

        } catch (e) {
            console.error(`Error importing ${payData.name}:`, e);
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
