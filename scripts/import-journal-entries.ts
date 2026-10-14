
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
    const transactionsDir = path.join(process.cwd(), '../extracted_data');
    const jeFile = path.join(transactionsDir, 'JournalEntry.csv');
    const jeAccountFile = path.join(transactionsDir, 'JournalEntryAccount.csv');

    if (!fs.existsSync(jeFile) || !fs.existsSync(jeAccountFile)) {
        console.error('CSV files not found in extracted_data');
        process.exit(1);
    }

    // Read files
    console.log('Reading CSV files...');
    const jeContent = fs.readFileSync(jeFile, 'utf-8');
    const jeAccountContent = fs.readFileSync(jeAccountFile, 'utf-8');

    const jeLines = jeContent.split('\n').filter(l => l.trim());
    const jeAccountLines = jeAccountContent.split('\n').filter(l => l.trim());

    // Parse Headers
    const jeHeaders = parseCSVLine(jeLines[0]);
    const jeAccountHeaders = parseCSVLine(jeAccountLines[0]);

    // Parse Data
    const journalEntries = jeLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        jeHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    const journalRows = jeAccountLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        jeAccountHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    // Group Rows by Parent Journal Entry
    const rowsByEntry: Record<string, any[]> = {};
    journalRows.forEach(row => {
        if (!rowsByEntry[row.parent]) {
            rowsByEntry[row.parent] = [];
        }
        rowsByEntry[row.parent].push(row);
    });

    console.log(`Found ${journalEntries.length} journal entries and ${journalRows.length} rows.`);

    for (const je of journalEntries) {
        try {
            // Check if exists
            const existing = await prisma.journalEntry.findUnique({
                where: { entryNumber: je.name }
            });

            if (existing) {
                console.log(`Journal Entry ${je.name} already exists. Skipping.`);
                continue;
            }

            const rows = rowsByEntry[je.name] || [];
            if (rows.length === 0) {
                console.warn(`No rows found for ${je.name}. Skipping.`);
                continue;
            }

            const createRows = [];

            for (const row of rows) {
                // Find or Create Account
                // Note: Accounts should ideally exist, but we can try to find by name
                // Warning: Account names might not match exactly if they were renamed.
                // Assuming Account Name is unique and matches.
                
                let account = await prisma.account.findUnique({
                    where: { name: row.account }
                });

                if (!account) {
                    console.warn(`Account '${row.account}' not found for JE ${je.name}. Creating as Expense (Default).`);
                    // Create minimal account to prevent failure
                    // You might want to review this logic
                    account = await prisma.account.create({
                        data: {
                            name: row.account,
                            type: 'EXPENSE', // Default fallback
                            isGroup: false
                        }
                    });
                }

                createRows.push({
                    accountId: account.id,
                    debit: parseFloat(row.debit) || 0,
                    credit: parseFloat(row.credit) || 0,
                    foreignDebit: parseFloat(row.debit) || 0, // Assuming base currency for now as source CSV is simple
                    foreignCredit: parseFloat(row.credit) || 0,
                    description: row.description || je.userRemark || ''
                });
            }

            // Create Journal Entry
            await prisma.journalEntry.create({
                data: {
                    entryNumber: je.name,
                    date: new Date(je.date),
                    description: je.userRemark || 'Imported Journal Entry',
                    reference: je.referenceNumber,
                    currency: 'PKR', // Default base
                    exchangeRate: 1.0,
                    rows: {
                        create: createRows
                    }
                }
            });

            console.log(`Imported Journal Entry: ${je.name}`);

        } catch (e) {
            console.error(`Error importing ${je.name}:`, e);
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
