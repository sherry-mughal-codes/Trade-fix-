
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting reconciliation of Purchase Invoices...');

    // 1. Fetch all Purchase Invoices
    const invoices = await prisma.invoice.findMany({
        where: { type: 'PURCHASE' },
        include: {
            // We need to find payments linked to this invoice via PaymentAllocation
            // However, PaymentAllocation is not directly available on Invoice in schema yet?
            // Let's check schema.
            // PaymentAllocation has `invoiceId`.
            // Invoice has `allocations`? No, schema said "allocations PaymentAllocation[]" commented out.
            // Wait, I see "allocations PaymentAllocation[]" in schema.prisma in my memory but commented out in the Read output earlier?
            // Let's check the schema again or just query PaymentAllocation directly.
        }
    });

    console.log(`Found ${invoices.length} purchase invoices.`);

    let updatedCount = 0;

    for (const inv of invoices) {
        // 2. Calculate Total Paid from PaymentAllocations
        const allocations = await prisma.paymentAllocation.findMany({
            where: { invoiceId: inv.id }
        });

        const calculatedPaidAmount = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);

        // 3. Check for discrepancies
        // We use a small epsilon for float comparison
        const diff = Math.abs(inv.paidAmount - calculatedPaidAmount);
        
        // Also verify balance
        const expectedBalance = inv.grandTotal - calculatedPaidAmount;
        const balanceDiff = Math.abs(inv.balanceAmount - expectedBalance);

        if (diff > 0.01 || balanceDiff > 0.01) {
            console.log(`Reconciling Invoice ${inv.invoiceNumber}:`);
            console.log(`  Current Paid: ${inv.paidAmount}, Calculated: ${calculatedPaidAmount}`);
            console.log(`  Current Balance: ${inv.balanceAmount}, Expected: ${expectedBalance}`);

            // 4. Update Invoice
            let newStatus = inv.status;
            if (inv.status !== 'CANCELLED') {
                if (expectedBalance <= 0.01) newStatus = 'PAID';
                else if (calculatedPaidAmount > 0) newStatus = 'PARTIALLY_PAID';
                else newStatus = 'SENT'; // or DRAFT if it was draft? Assuming SENT/OPEN if not draft
                
                // Preserve DRAFT if it was DRAFT and no payments? 
                // If paidAmount > 0, it can't be DRAFT usually.
                if (inv.status === 'DRAFT' && calculatedPaidAmount > 0) {
                    newStatus = 'PARTIALLY_PAID'; // Auto-open if paid
                } else if (inv.status === 'DRAFT') {
                    newStatus = 'DRAFT'; // Keep draft
                }
            }

            await prisma.invoice.update({
                where: { id: inv.id },
                data: {
                    paidAmount: calculatedPaidAmount,
                    balanceAmount: expectedBalance,
                    status: newStatus
                }
            });
            updatedCount++;
        }
    }

    console.log(`Reconciliation complete. Updated ${updatedCount} invoices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
