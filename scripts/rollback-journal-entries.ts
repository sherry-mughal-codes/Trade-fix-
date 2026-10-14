
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
    console.log('Rolling back Imported Journal Entries...');

    const transactionsDir = path.join(process.cwd(), '../extracted_data');
    const jeFile = path.join(transactionsDir, 'JournalEntry.csv');
    const jeAccountFile = path.join(transactionsDir, 'JournalEntryAccount.csv');

    if (!fs.existsSync(jeFile)) {
        console.error('CSV file not found');
        process.exit(1);
    }

    // 1. Get JE Numbers from Import CSV
    const jeContent = fs.readFileSync(jeFile, 'utf-8');
    const jeLines = jeContent.split('\n').filter(l => l.trim());
    const jeHeaders = parseCSVLine(jeLines[0]);
    const nameIdx = jeHeaders.findIndex(h => h.trim() === 'name');

    if (nameIdx === -1) {
        console.error('Could not find "name" column in CSV');
        return;
    }

    const importedJENumbers = jeLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        return values[nameIdx];
    }).filter(n => n);

    console.log(`Identified ${importedJENumbers.length} Journal Entries to delete.`);

    // 2. Identify Accounts created during import
    // We can identify them by checking the JournalEntryAccount.csv unique account names
    let potentialAccounts = new Set<string>();

    if (fs.existsSync(jeAccountFile)) {
        const jeAccountContent = fs.readFileSync(jeAccountFile, 'utf-8');
        const lines = jeAccountContent.split('\n').filter(l => l.trim());
        const headers = parseCSVLine(lines[0]);
        const accIdx = headers.findIndex(h => h.trim() === 'account');

        if (accIdx !== -1) {
            lines.slice(1).forEach(l => {
                const v = parseCSVLine(l);
                if (v[accIdx]) potentialAccounts.add(v[accIdx]);
            });
        }
    }

    // 3. Delete JEs
    const deleteResult = await prisma.journalEntry.deleteMany({
        where: {
            entryNumber: { in: importedJENumbers }
        }
    });

    console.log(`Deleted ${deleteResult.count} Journal Entries.`);

    // 4. Cleanup Accounts
    console.log(`Checking ${potentialAccounts.size} potential accounts for cleanup...`);

    let deletedAccs = 0;
    const settings = await prisma.companySettings.findFirst();

    for (const accName of Array.from(potentialAccounts)) {
        // Find account
        const account = await prisma.account.findUnique({
            where: { name: accName },
            include: {
                _count: {
                    select: { journalRows: true }
                }
            }
        });

        if (account) {
            // Only delete if:
            // 1. It is not a system account
            // 2. It has 0 journal rows (since we just deleted the JEs)
            // 3. It is not a default account in settings
            
            const isDefault = 
                settings?.defaultPayableAccount === account.id ||
                settings?.defaultReceivableAccount === account.id ||
                settings?.defaultSalesAccount === account.id ||
                settings?.defaultPurchaseAccount === account.id;

            if (!account.isSystem && !isDefault && account._count.journalRows === 0) {
                try {
                    await prisma.account.delete({ where: { id: account.id } });
                    console.log(`Deleted unused account: ${accName}`);
                    deletedAccs++;
                } catch (e) {
                    console.warn(`Could not delete account ${accName}:`, e);
                }
            } else {
                // console.log(`Skipped account ${accName} (System: ${account.isSystem}, Rows: ${account._count.journalRows})`);
            }
        }
    }
    console.log(`Cleanup complete. Deleted ${deletedAccs} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
