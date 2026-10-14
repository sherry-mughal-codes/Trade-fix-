import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import path from 'path';

const prisma = new PrismaClient();
const SOURCE_DB_PATH = path.join(__dirname, '../../backup.db'); // Adjust path as needed

async function main() {
  console.log(`Connecting to source database: ${SOURCE_DB_PATH}`);
  let sourceDb;
  try {
    sourceDb = new Database(SOURCE_DB_PATH, { readonly: true });
  } catch (error) {
    console.error("Could not open source database. Make sure 'backup.db' is in the project root.");
    process.exit(1);
  }

  console.log('Starting migration...');

  // 1. Migrate Parties
  console.log('Migrating Parties...');
  const parties = sourceDb.prepare('SELECT * FROM Party').all();
  for (const p of parties) {
    // Check if party exists (by name, since ID might be different format, but we use UUIDs now)
    // Actually, let's try to keep the original ID if it's a UUID, otherwise generate new one.
    // The source 'name' is the ID in Frappe Books usually.
    // Let's use the 'name' as the 'id' if possible, or just map fields.
    
    // Frappe Books Party: name (ID), email, phone, address, currency, role
    await prisma.party.create({
      data: {
        id: p.name, // Use the name as ID to preserve relationships
        name: p.name, // Also use it as name
        email: p.email || null,
        phone: p.phone || null,
        address: p.address || null, // Might be a link, but we'll store as string for now
        type: p.role === 'Customer' ? 'customer' : (p.role === 'Supplier' ? 'supplier' : 'both'),
        currency: p.currency || 'USD',
      }
    }).catch(e => console.warn(`Skipping party ${p.name}: ${e.message}`));
  }
  console.log(`Migrated ${parties.length} parties.`);

  // 2. Migrate Invoices (Sales & Purchase)
  console.log('Migrating Invoices...');
  
  // Sales Invoices
  const salesInvoices = sourceDb.prepare('SELECT * FROM SalesInvoice').all();
  for (const inv of salesInvoices) {
    try {
      await prisma.invoice.create({
        data: {
          id: inv.name,
          invoiceNumber: inv.name,
          type: 'SALE',
          status: inv.status || 'DRAFT',
          date: new Date(inv.date),
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          partyId: inv.party,
          currency: inv.currency || 'USD',
          exchangeRate: inv.exchangeRate || 1.0,
          subTotal: inv.netTotal || 0,
          taxTotal: (inv.grandTotal - inv.netTotal) || 0, // Approx
          grandTotal: inv.grandTotal || 0,
          baseGrandTotal: inv.baseGrandTotal || (inv.grandTotal * (inv.exchangeRate || 1)),
          paidAmount: inv.outstandingAmount ? (inv.grandTotal - inv.outstandingAmount) : 0, // Approx
          balanceAmount: inv.outstandingAmount || 0,
          items: {
            create: sourceDb.prepare('SELECT * FROM SalesInvoiceItem WHERE parent = ?').all(inv.name).map((item: any) => ({
              description: item.item || item.description || 'Item',
              quantity: Number(item.qty || 0),
              unitPrice: Number(item.rate || 0),
              amount: Number(item.amount || 0)
            }))
          }
        }
      });
    } catch (e: any) {
        console.warn(`Failed to migrate Sales Invoice ${inv.name}: ${e.message}`);
    }
  }

  // Purchase Invoices
  const purchaseInvoices = sourceDb.prepare('SELECT * FROM PurchaseInvoice').all();
  for (const inv of purchaseInvoices) {
    try {
      await prisma.invoice.create({
        data: {
          id: inv.name,
          invoiceNumber: inv.name,
          type: 'PURCHASE',
          status: inv.status || 'DRAFT',
          date: new Date(inv.date),
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          partyId: inv.party, // Make sure supplier exists in Party table
          currency: inv.currency || 'USD',
          exchangeRate: Number(inv.exchangeRate || 1.0),
          subTotal: Number(inv.netTotal || 0),
          taxTotal: Number((inv.grandTotal - inv.netTotal) || 0),
          grandTotal: Number(inv.grandTotal || 0),
          baseGrandTotal: Number(inv.baseGrandTotal || (inv.grandTotal * (inv.exchangeRate || 1))),
          paidAmount: Number(inv.outstandingAmount ? (inv.grandTotal - inv.outstandingAmount) : 0),
          balanceAmount: Number(inv.outstandingAmount || 0),
          items: {
            create: sourceDb.prepare('SELECT * FROM PurchaseInvoiceItem WHERE parent = ?').all(inv.name).map((item: any) => ({
              description: item.item || item.description || 'Item',
              quantity: Number(item.qty || 0),
              unitPrice: Number(item.rate || 0),
              amount: Number(item.amount || 0)
            }))
          }
        }
      });
    } catch (e: any) {
        console.warn(`Failed to migrate Purchase Invoice ${inv.name}: ${e.message}`);
    }
  }
  console.log(`Migrated Invoices.`);

  // 3. Migrate Payments
  console.log('Migrating Payments...');
  const payments = sourceDb.prepare('SELECT * FROM Payment').all();
  for (const pay of payments) {
    try {
        // Find linked invoice if any (from PaymentFor table)
        const links = sourceDb.prepare("SELECT referenceName FROM PaymentFor WHERE parent = ? LIMIT 1").get(pay.name);
        const linkedInvoiceId = links ? links.referenceName : null;

        await prisma.payment.create({
            data: {
                id: pay.name,
                paymentNumber: pay.name,
                date: new Date(pay.date),
                type: pay.paymentType === 'Receive' ? 'RECEIVE' : 'PAY',
                method: pay.paymentMethod || 'Cash',
                reference: pay.referenceId || null,
                partyId: pay.party,
                amount: Number(pay.amount || 0),
                invoiceId: linkedInvoiceId, // Might fail if invoice wasn't migrated, but we catch error
                notes: pay.referenceId ? `Ref: ${pay.referenceId}` : null
            }
        });
    } catch (e: any) {
        console.warn(`Failed to migrate Payment ${pay.name}: ${e.message}`);
    }
  }
  console.log(`Migrated Payments.`);

  // 4. Migrate Journal Entries
  console.log('Migrating Journal Entries...');
  const journals = sourceDb.prepare('SELECT * FROM JournalEntry').all();
  for (const je of journals) {
    try {
        await prisma.journalEntry.create({
            data: {
                id: je.name,
                entryNumber: je.name,
                date: new Date(je.date),
                description: je.userRemark || null,
                rows: {
                    create: sourceDb.prepare('SELECT * FROM JournalEntryAccount WHERE parent = ?').all(je.name).map((row: any) => ({
                        account: row.account,
                        debit: Number(row.debit || 0),
                        credit: Number(row.credit || 0)
                    }))
                }
            }
        });
    } catch (e: any) {
        console.warn(`Failed to migrate Journal Entry ${je.name}: ${e.message}`);
    }
  }
  console.log(`Migrated Journal Entries.`);

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
