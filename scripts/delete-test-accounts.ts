
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for accounts with "Test" in the name...');

    // 1. Find accounts matching "Test"
    const accounts = await prisma.account.findMany({
        where: {
            name: {
                contains: 'Test'
            }
        },
        include: {
            _count: {
                select: { journalRows: true }
            }
        }
    });

    if (accounts.length === 0) {
        console.log('No accounts found with "Test" in the name.');
        return;
    }

    console.log(`Found ${accounts.length} accounts:`);
    accounts.forEach(acc => {
        console.log(`- ${acc.name} (ID: ${acc.id}, Journal Rows: ${acc._count.journalRows}, System: ${acc.isSystem})`);
    });

    // 2. Delete eligible accounts
    let deletedCount = 0;
    
    for (const acc of accounts) {
        // System check overridden for "Test" cleanup
        // if (acc.isSystem) {
        //    console.log(`Skipping ${acc.name}: System account.`);
        //    continue;
        // }

        if (acc._count.journalRows > 0) {
            console.log(`Skipping ${acc.name}: Has ${acc._count.journalRows} associated transactions. Cannot delete safely.`);
            continue;
        }

        try {
            await prisma.account.delete({
                where: { id: acc.id }
            });
            console.log(`Deleted: ${acc.name}`);
            deletedCount++;
        } catch (error) {
            console.error(`Failed to delete ${acc.name}:`, error);
        }
    }

    console.log(`\nOperation complete. Deleted ${deletedCount} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
