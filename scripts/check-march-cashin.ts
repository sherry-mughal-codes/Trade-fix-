
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking March Cash IN/OUT...');

    const now = new Date();
    // Assuming user means March 2026 based on previous context, or current year March?
    // Let's check for current year March.
    // Env says "Today's date: 2026-03-11". So we are in March 2026.
    
    const startOfMonth = new Date('2026-02-01');
    const endOfMonth = new Date('2026-03-01');

    console.log(`Period: ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);

    // 1. Identify Cash/Bank Accounts (Same logic as dashboard)
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
                subType: { in: ["Receivable", "Inventory", "Fixed Asset"] }
            }
        },
        select: { id: true, name: true, code: true }
    });

    const cashAccountIds = cashAccounts.map(a => a.id);
    console.log(`Monitored Accounts (${cashAccounts.length}):`);
    cashAccounts.forEach(a => console.log(` - ${a.name} (${a.code})`));

    // 2. Fetch Journal Rows for these accounts in March
    const journalRows = await prisma.journalRow.findMany({
        where: {
            accountId: { in: cashAccountIds },
            journalEntry: {
                date: {
                    gte: startOfMonth,
                    lt: endOfMonth
                }
            }
        },
        include: {
            journalEntry: true,
            account: true
        }
    });

    console.log(`\nFound ${journalRows.length} transactions in March.`);

    let totalDebit = 0;
    let totalCredit = 0;

    journalRows.forEach(row => {
        totalDebit += row.debit;
        totalCredit += row.credit;
        console.log(` [${row.journalEntry.date.toISOString().split('T')[0]}] ${row.account.name} (${row.account.code || 'No Code'}): Debit=${row.debit}, Credit=${row.credit} (Ref: ${row.journalEntry.reference || row.journalEntry.description})`);
    });

    console.log('\nSummary for Feb 2026:');
    console.log(`Total Cash IN (Debit):  ${totalDebit}`);
    console.log(`Total Cash OUT (Credit): ${totalCredit}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
