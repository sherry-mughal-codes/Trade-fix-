
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for transactions linked to Group Accounts...');

    // 1. Identify Group Accounts
    const groupAccounts = await prisma.account.findMany({
        where: {
            isGroup: true
        },
        select: {
            id: true,
            name: true,
            code: true,
            type: true
        }
    });

    console.log(`Found ${groupAccounts.length} Group Accounts.`);
    if (groupAccounts.length === 0) return;

    const groupAccountIds = groupAccounts.map(a => a.id);

    // 2. Find Journal Rows linked to these accounts
    const invalidRows = await prisma.journalRow.findMany({
        where: {
            accountId: { in: groupAccountIds }
        },
        include: {
            account: true,
            journalEntry: true
        }
    });

    console.log(`\nFound ${invalidRows.length} transactions linked to Group Accounts.`);

    if (invalidRows.length > 0) {
        // Group by account
        const accountStats = new Map<string, { name: string, code: string, count: number }>();
        
        invalidRows.forEach(row => {
            const key = row.accountId;
            if (!accountStats.has(key)) {
                accountStats.set(key, { 
                    name: row.account.name, 
                    code: row.account.code || 'N/A', 
                    count: 0 
                });
            }
            accountStats.get(key)!.count++;
        });

        console.log('\nSummary of Group Accounts with Transactions:');
        accountStats.forEach((stats) => {
            console.log(` - Account: ${stats.name} (Code: ${stats.code}) | Transaction Count: ${stats.count}`);
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
