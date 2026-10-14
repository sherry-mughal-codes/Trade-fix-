
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Calculating Total Cash Out for 2025 (Excluding Purchase Payments)...');

    // 1. Define Date Range
    const startOfYear = new Date('2025-01-01');
    const endOfYear = new Date('2025-12-31T23:59:59.999Z');

    // 3. Identify Cash/Bank Account IDs
    const cashAccounts = await prisma.account.findMany({
        where: {
            type: "ASSET",
            OR: [
                { subType: { in: ["Cash", "Bank"] } },
                { name: { contains: "Cash" } },
                { name: { contains: "Bank" } },
                { name: { contains: "UBL" } }, 
                { name: { contains: "Alfalah" } }
            ],
            NOT: {
                // Ensure we don't accidentally pick up other asset types
                subType: { in: ["Receivable", "Inventory", "Fixed Asset"] }
            }
        },
        select: { id: true, name: true }
    });
    
    const cashAccountIds = cashAccounts.map(a => a.id);
    
    // 4. Find Journal Rows (Credits to Cash/Bank)
    const journalRows = await prisma.journalRow.findMany({
        where: {
            accountId: { in: cashAccountIds },
            journalEntry: {
                date: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            },
            credit: { gt: 0 }
        },
        include: {
            journalEntry: {
                include: {
                    payment: true,
                    invoice: true
                }
            }
        }
    });

    let totalCashOut = 0;
    let purchasePayments = 0;
    let otherCashOut = 0;

    console.log(`\nAnalyzing ${journalRows.length} cash-out transactions...`);

    for (const row of journalRows) {
        const amount = row.credit;
        totalCashOut += amount;

        const je = row.journalEntry;
        
        // Logic to identify Purchase Payments:
        // 1. Linked to a Payment record with type 'PAY'
        // 2. Linked to an Invoice with type 'PURCHASE'
        // 3. Description indicates 'Payment to Vendor' or 'Purchase Payment'
        
        let isPurchaseRelated = false;

        if (je.payment && je.payment.type === 'PAY') {
            isPurchaseRelated = true;
        } else if (je.invoice && je.invoice.type === 'PURCHASE') {
            isPurchaseRelated = true;
        } else if (je.description && (
            je.description.includes('Payment to Vendor') || 
            je.description.includes('Purchase Payment') ||
            je.description.includes('Bill Payment')
        )) {
            isPurchaseRelated = true;
        }

        if (isPurchaseRelated) {
            purchasePayments += amount;
        } else {
            otherCashOut += amount;
            // Uncomment to debug non-purchase cash outs
            // console.log(`[OTHER] ${je.date.toISOString().split('T')[0]} - ${je.entryNumber}: ${amount} (${je.description})`);
        }
    }

    console.log('\n------------------------------------------------');
    console.log(`Total Cash Out (2025):             ${totalCashOut.toFixed(2)}`);
    console.log(`Less: Purchase Payments:           ${purchasePayments.toFixed(2)}`);
    console.log(`------------------------------------------------`);
    console.log(`Net Other Cash Out (2025):         ${otherCashOut.toFixed(2)}`);
    console.log('------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
