
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
    console.log('Verifying Journal Entry Imports...');

    const transactionsDir = path.join(process.cwd(), '../extracted_data');
    const jeAccountFile = path.join(transactionsDir, 'JournalEntryAccount.csv');

    if (!fs.existsSync(jeAccountFile)) {
        console.error('CSV file not found');
        process.exit(1);
    }

    const jeAccountContent = fs.readFileSync(jeAccountFile, 'utf-8');
    const jeAccountLines = jeAccountContent.split('\n').filter(l => l.trim());
    const jeAccountHeaders = parseCSVLine(jeAccountLines[0]);

    // Manually map indices if headers are not reliable or to be safe
    // Assuming: name,account,debit,credit,idx,parent,...
    // But CSV header might be: name,account,debit,credit,idx,parent,parentSchemaName,parentFieldname
    
    const journalRows: any[] = [];
    const headers = jeAccountHeaders.map(h => h.trim());

    // Indices
    const parentIdx = headers.indexOf('parent');
    const debitIdx = headers.indexOf('debit');
    const creditIdx = headers.indexOf('credit');
    
    if (parentIdx === -1 || debitIdx === -1 || creditIdx === -1) {
        console.error("Critical headers missing in CSV:", headers);
        return;
    }

    jeAccountLines.slice(1).forEach(line => {
        const values = parseCSVLine(line);
        if (values.length < headers.length) return; // Skip malformed
        
        journalRows.push({
            parent: values[parentIdx],
            debit: parseFloat(values[debitIdx]) || 0,
            credit: parseFloat(values[creditIdx]) || 0
        });
    });

    // Group CSV Rows by Parent (JE Number)
    const csvTotals: Record<string, { debit: number, credit: number }> = {};
    
    journalRows.forEach(row => {
        if (!row.parent) return;
        if (!csvTotals[row.parent]) {
            csvTotals[row.parent] = { debit: 0, credit: 0 };
        }
        csvTotals[row.parent].debit += row.debit;
        csvTotals[row.parent].credit += row.credit;
    });

    console.log(`CSV Source: Found ${Object.keys(csvTotals).length} distinct Journal Entries.`);
    console.log(`Checking against database...`);

    // Fetch all JEs from DB
    const dbJEs = await prisma.journalEntry.findMany({
        include: { rows: true }
    });
    
    // Create Map for fast lookup
    const dbMap = new Map<string, typeof dbJEs[0]>();
    dbJEs.forEach(je => dbMap.set(je.entryNumber, je));

    let mismatchCount = 0;
    let missingCount = 0;

    for (const jeNumber of Object.keys(csvTotals)) {
        const csv = csvTotals[jeNumber];
        const dbJe = dbMap.get(jeNumber);

        if (!dbJe) {
            console.warn(`[MISSING] ${jeNumber} found in CSV but not in DB.`);
            missingCount++;
            continue;
        }

        const dbDebit = dbJe.rows.reduce((sum, r) => sum + r.debit, 0);
        const dbCredit = dbJe.rows.reduce((sum, r) => sum + r.credit, 0);

        // Check for mismatch (allow small float diff)
        const debitDiff = Math.abs(csv.debit - dbDebit);
        const creditDiff = Math.abs(csv.credit - dbCredit);

        if (debitDiff > 0.01 || creditDiff > 0.01) {
            console.error(`[MISMATCH] ${jeNumber}`);
            console.error(`  CSV: Debit=${csv.debit.toFixed(2)}, Credit=${csv.credit.toFixed(2)}`);
            console.error(`  DB:  Debit=${dbDebit.toFixed(2)}, Credit=${dbCredit.toFixed(2)}`);
            mismatchCount++;
        }
    }

    if (mismatchCount === 0 && missingCount === 0) {
        console.log('Verification Success: All imported amounts match the CSV source.');
    } else {
        console.error(`Verification Failed: ${mismatchCount} mismatches, ${missingCount} missing entries.`);
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
