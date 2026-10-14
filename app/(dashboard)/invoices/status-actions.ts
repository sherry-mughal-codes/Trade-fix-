'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/rbac"
import { requireOrganizationId } from "@/lib/tenant-db"
import { enforceCustomerCreditLimit } from "@/lib/credit-control"
import { syncInvoiceInventory } from "@/lib/inventory"
import { syncInvoiceCommercialJournal, syncInvoiceInventoryAccounting } from "@/lib/inventory-accounting"

export async function updateInvoiceStatus(id: string, status: string) {
  if (!(await hasPermission("invoices.action.changeStatus"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await prisma.$transaction(async (tx: any) => {
        // 1. Get current invoice details
        const invoice = await tx.invoice.findFirst({ 
            where: { id, organizationId },
            select: {
                id: true,
                partyId: true,
                type: true,
                status: true,
                balanceAmount: true,
            }
        });

        if (!invoice) throw new Error("Invoice not found");

        // 2. Update Status
        if (invoice.type === "SALE" && ['SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(status)) {
            await enforceCustomerCreditLimit(tx, organizationId, invoice.partyId, invoice.balanceAmount, invoice.id);
        }

        await tx.invoice.update({
            where: { id },
            data: { status },
        });

        await syncInvoiceInventory(tx, organizationId, id);
        await syncInvoiceCommercialJournal(tx, organizationId, id);
        await syncInvoiceInventoryAccounting(tx, organizationId, id);
    });

    revalidatePath("/invoices")
    revalidatePath("/inventory")
    revalidatePath("/inventory/batches")
    revalidatePath("/inventory/ledger")
    revalidatePath("/items")
    return { success: true }
  } catch (error) {
    console.error("Failed to update invoice status:", error)
    return { error: `Failed to update status: ${error instanceof Error ? error.message : String(error)}` }
  }
}
