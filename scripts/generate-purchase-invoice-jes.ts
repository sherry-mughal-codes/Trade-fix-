
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Generating missing Journal Entries for Purchase Invoices...');

    // 1. Get Settings & Default Accounts
    const settings = await prisma.companySettings.findFirst();
    let payableAccountId = settings?.defaultPayableAccount;
    
    let purchaseAccountId = settings?.defaultPurchaseAccount;

    if (!purchaseAccountId) {
        // Try to find "Cost of Goods Sold" or "Purchases"
        const acc = await prisma.account.findFirst({
            where: { 
                OR: [
                    { name: "Cost of Goods Sold" },
                    { name: "Purchases" },
                    { name: "General Purchases" }
                ]
            }
        });
        
        if (acc) {
            purchaseAccountId = acc.id;
        } else {
            // Create default purchase account
            console.log("Creating default 'Cost of Goods Sold' account...");
            const newAcc = await prisma.account.create({
                data: {
                    name: "Cost of Goods Sold",
                    type: "EXPENSE",
                    code: "5000"
                }
            });
            purchaseAccountId = newAcc.id;
        }
    }

    if (!payableAccountId) {
        // Try to find "Accounts Payable"
        const acc = await prisma.account.findFirst({
            where: { name: "Accounts Payable" }
        });
        
        if (acc) {
            payableAccountId = acc.id;
        } else {
            console.error("Default Payable Account not set in settings and 'Accounts Payable' not found. Aborting.");
            return;
        }
    }

    // 2. Find Invoices
    const invoices = await prisma.invoice.findMany({
        where: {
            type: 'PURCHASE',
            journalEntryId: null,
            status: { in: ['SENT', 'PAID', 'PARTIALLY_PAID'] } // Skip DRAFT and CANCELLED
        },
        include: {
            party: true
        }
    });

    console.log(`Found ${invoices.length} invoices needing JEs.`);

    // 3. Generate JEs
    for (const inv of invoices) {
        const jeNumber = `JRN-${inv.invoiceNumber}`;
        const description = `Purchase Invoice #${inv.invoiceNumber} - ${inv.party.name}`;
        
        // Amounts
        // Debit Expense (Purchase), Credit Liability (Payable)
        const amount = inv.grandTotal;
        const exchangeRate = inv.exchangeRate || 1.0;
        const baseAmount = inv.baseGrandTotal > 0 ? inv.baseGrandTotal : (amount * exchangeRate);

        try {
            await prisma.$transaction(async (tx) => {
                const je = await tx.journalEntry.create({
                    data: {
                        entryNumber: jeNumber,
                        date: inv.date,
                        description: description,
                        reference: inv.invoiceNumber,
                        currency: inv.currency,
                        exchangeRate: exchangeRate,
                        rows: {
                            create: [
                                {
                                    accountId: purchaseAccountId!, // Debit Expense
                                    debit: baseAmount,
                                    credit: 0,
                                    foreignDebit: amount,
                                    foreignCredit: 0,
                                    description: "Purchase Expense"
                                },
                                {
                                    accountId: payableAccountId, // Credit Payable
                                    debit: 0,
                                    credit: baseAmount,
                                    foreignDebit: 0,
                                    foreignCredit: amount,
                                    description: "Accounts Payable"
                                }
                            ]
                        }
                    }
                });

                await tx.invoice.update({
                    where: { id: inv.id },
                    data: { journalEntryId: je.id }
                });
            });
            // console.log(`Generated JE for ${inv.invoiceNumber}`);
        } catch (e) {
            console.error(`Failed to generate JE for ${inv.invoiceNumber}:`, e);
        }
    }
    console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
