
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
    const invoiceFile = path.join(transactionsDir, 'PurchaseInvoice.csv');
    const itemFile = path.join(transactionsDir, 'PurchaseInvoiceItem.csv');

    if (!fs.existsSync(invoiceFile) || !fs.existsSync(itemFile)) {
        console.error('CSV files not found in extracted_data/transactions');
        process.exit(1);
    }

    // Read files
    console.log('Reading CSV files...');
    const invoiceContent = fs.readFileSync(invoiceFile, 'utf-8');
    const itemContent = fs.readFileSync(itemFile, 'utf-8');

    const invoiceLines = invoiceContent.split('\n').filter(l => l.trim());
    const itemLines = itemContent.split('\n').filter(l => l.trim());

    // Parse Headers
    const invoiceHeaders = parseCSVLine(invoiceLines[0]);
    const itemHeaders = parseCSVLine(itemLines[0]);

    // Parse Data
    const invoices = invoiceLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        invoiceHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    const items = itemLines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        itemHeaders.forEach((h, i) => obj[h.trim()] = values[i]);
        return obj;
    });

    // Group items by parent
    const itemsByParent: Record<string, any[]> = {};
    items.forEach(item => {
        if (!itemsByParent[item.parent]) {
            itemsByParent[item.parent] = [];
        }
        itemsByParent[item.parent].push(item);
    });

    console.log(`Found ${invoices.length} invoices and ${items.length} items.`);

    // Import Loop
    for (const inv of invoices) {
        try {
            // Check if exists
            const existing = await prisma.invoice.findUnique({
                where: { invoiceNumber: inv.name }
            });

            if (existing) {
                console.log(`Invoice ${inv.name} already exists. Skipping.`);
                continue;
            }

            // 1. Handle Party (Supplier)
            let party = await prisma.party.findFirst({
                where: { name: inv.party }
            });

            if (!party) {
                console.log(`Creating new supplier: ${inv.party}`);
                party = await prisma.party.create({
                    data: {
                        name: inv.party,
                        type: 'supplier',
                        currency: 'PKR' // Default for now
                    }
                });
            } else {
                // Ensure role includes supplier
                if (party.type === 'customer') {
                    await prisma.party.update({
                        where: { id: party.id },
                        data: { type: 'both' }
                    });
                }
            }

            // 2. Prepare Items
            const invItems = itemsByParent[inv.name] || [];
            const createItems = [];

            for (const item of invItems) {
                // Check Item Master
                let dbItem = await prisma.item.findFirst({
                    where: { name: item.item }
                });

                if (!dbItem && item.item) {
                     // Create Item if missing
                     dbItem = await prisma.item.create({
                         data: { name: item.item }
                     });
                }

                createItems.push({
                    itemId: dbItem?.id, // Optional link
                    description: item.description || item.item || 'Item',
                    quantity: parseFloat(item.quantity) || 0,
                    unitPrice: parseFloat(item.rate) || 0,
                    amount: parseFloat(item.amount) || 0,
                    // discount: parseFloat(item.itemDiscountAmount) || 0 
                });
            }

            // 3. Create Invoice
            // Status Logic
            let status = 'DRAFT';
            const outstanding = parseFloat(inv.outstandingAmount) || 0;
            const grandTotal = parseFloat(inv.grandTotal) || 0;
            const isSubmitted = inv.submitted === '1';
            const isCancelled = inv.cancelled === '1';

            if (isCancelled) status = 'CANCELLED';
            else if (!isSubmitted) status = 'DRAFT';
            else if (outstanding === 0) status = 'PAID';
            else if (outstanding < grandTotal) status = 'PARTIALLY_PAID';
            else status = 'SENT'; // Open

            // Currency defaults
            const currency = inv.currency || 'PKR';
            const exchangeRate = parseFloat(inv.exchangeRate) || 1.0;

            await prisma.invoice.create({
                data: {
                    invoiceNumber: inv.name,
                    type: 'PURCHASE',
                    date: new Date(inv.date),
                    dueDate: inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date), // Fallback to date
                    partyId: party.id,
                    currency: currency,
                    exchangeRate: exchangeRate,
                    status: status,
                    subTotal: parseFloat(inv.netTotal) || 0,
                    grandTotal: grandTotal,
                    baseGrandTotal: parseFloat(inv.baseGrandTotal) || grandTotal,
                    balanceAmount: outstanding,
                    paidAmount: grandTotal - outstanding,
                    terms: inv.terms,
                    items: {
                        create: createItems
                    }
                }
            });

            console.log(`Imported Invoice: ${inv.name}`);

        } catch (e) {
            console.error(`Error importing ${inv.name}:`, e);
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
