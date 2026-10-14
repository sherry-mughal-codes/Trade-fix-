
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up orphaned Journal Rows...');

    // 1. Find all Journal Rows where Journal Entry does not exist
    // This is tricky with Prisma findMany directly, but we can do a raw query or fetch all IDs.
    // Given the previous investigation, we know specific rows exist without a valid parent.
    
    // Let's verify counts first
    const allRowsCount = await prisma.journalRow.count();
    const allEntriesCount = await prisma.journalEntry.count();
    
    console.log(`Total Rows: ${allRowsCount}`);
    console.log(`Total Entries: ${allEntriesCount}`);

    // We can use deleteMany with a where clause that checks for non-existent relation?
    // Prisma doesn't support "where relation is null" for required relations easily if foreign key constraint is missing or corrupted.
    // In SQLite, if FK constraints are not enforced, this happens.
    
    // Fetch all rows and check existence of parent manually (slow but safe) or raw query.
    // Raw query is better.
    
    const orphans = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM JournalRow 
        WHERE journalEntryId NOT IN (SELECT id FROM JournalEntry)
    `;

    console.log(`Found ${orphans.length} orphaned rows.`);

    if (orphans.length > 0) {
        const deleted = await prisma.journalRow.deleteMany({
            where: {
                id: { in: orphans.map(o => o.id) }
            }
        });
        console.log(`Deleted ${deleted.count} orphaned rows.`);
    } else {
        console.log("No orphans found.");
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
