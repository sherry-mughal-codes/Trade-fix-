'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/rbac"
import { requireOrganizationId } from "@/lib/tenant-db"

export async function createPayment(formData: FormData) {
  if (!(await hasPermission("invoices.payment.record"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    const invoiceId = formData.get("invoiceId") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const date = new Date(formData.get("date") as string);
    const method = formData.get("method") as string;
    const accountId = formData.get("accountId") as string;
    const reference = formData.get("reference") as string;
    const notes = formData.get("notes") as string;
    // We'll ignore currency/rate for now as payment is in invoice currency.
    // However, for journal entry, we need to convert amount to base currency using the rate.
    const exchangeRate = parseFloat(formData.get("exchangeRate") as string) || 1.0;
    
    if (!invoiceId || !amount || !date || !method || !accountId) {
        return { error: "Missing required fields" };
    }

    await prisma.$transaction(async (tx: any) => {
        // 1. Get Invoice Details
        const invoice = await tx.invoice.findFirst({
            where: { id: invoiceId, organizationId },
            include: { party: true }
        });

        if (!invoice) throw new Error("Invoice not found");

        // 2. Validate Amount
        if (amount > invoice.balanceAmount) {
            throw new Error("Payment amount cannot exceed balance amount");
        }

        // 3. Get Company Settings for numbering
        const settings = await tx.companySettings.findFirst({ where: { organizationId } });
        const paymentNumber = `PAY-${Date.now()}`; // specific numbering can be added to settings later

        // 4. Create Payment Record
        const paymentType = invoice.type === 'SALE' ? 'RECEIVE' : 'PAY';
        
        const payment = await tx.payment.create({
            data: {
                organizationId,
                paymentNumber,
                date,
                type: paymentType,
                method,
                reference,
                notes,
                amount,
                partyId: invoice.partyId,
                invoiceId: invoice.id,
            }
        });

        // 5. Update Invoice
        const newPaidAmount = invoice.paidAmount + amount;
        const newBalanceAmount = invoice.grandTotal - newPaidAmount;
        let newStatus = invoice.status;

        if (newBalanceAmount === 0) {
            newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID'; // You might need to add this status to your enum if strict, otherwise string is fine
        }

        await tx.invoice.update({
            where: { id: invoice.id },
            data: {
                paidAmount: newPaidAmount,
                balanceAmount: newBalanceAmount,
                status: newStatus
            }
        });

        // 6. Create Journal Entry
        // SALE: Debit Selected Account (Asset), Credit Accounts Receivable
        // PURCHASE: Debit Accounts Payable, Credit Selected Account (Asset)
        
        let debitAccountId: string | undefined;
        let creditAccountId: string | undefined;

        // Check if selected payment account is group
        const paymentAccount = await tx.account.findFirst({ where: { id: accountId, organizationId } });
        if (paymentAccount && paymentAccount.isGroup) {
             throw new Error(`Selected payment account "${paymentAccount.name}" is a group account. Cannot post transaction.`);
        }

        if (invoice.type === 'SALE') {
            debitAccountId = accountId; // Cash/Bank
            // Get default receivable account
            if (settings?.defaultReceivableAccount) {
                const arAccount = await tx.account.findFirst({ where: { organizationId, name: settings.defaultReceivableAccount } });
                if (arAccount) {
                     if (arAccount.isGroup) throw new Error(`Default Receivable Account "${arAccount.name}" is a group account. Cannot post transaction.`);
                     creditAccountId = arAccount.id;
                }
            }
        } else {
            creditAccountId = accountId; // Cash/Bank
            // Get default payable account
            if (settings?.defaultPayableAccount) {
                const apAccount = await tx.account.findFirst({ where: { organizationId, name: settings.defaultPayableAccount } });
                if (apAccount) {
                     if (apAccount.isGroup) throw new Error(`Default Payable Account "${apAccount.name}" is a group account. Cannot post transaction.`);
                     debitAccountId = apAccount.id;
                }
            }
        }

        if (debitAccountId && creditAccountId) {
            const entryNumber = settings ? `${settings.journalPrefix}${settings.journalCurrentNumber}` : `JE-${Date.now()}`;
            
            await tx.journalEntry.create({
                data: {
                    entryNumber,
                    organizationId,
                    date,
                    description: `Payment for ${invoice.invoiceNumber}`,
                    reference: paymentNumber,
                    payment: { connect: { id: payment.id } },
                    rows: {
                        create: [
                            {
                                organizationId,
                                accountId: debitAccountId,
                                debit: amount * exchangeRate, // Convert to base currency
                                credit: 0,
                                description: `Debit`
                            },
                            {
                                organizationId,
                                accountId: creditAccountId,
                                debit: 0,
                                credit: amount * exchangeRate, // Convert to base currency
                                description: `Credit`
                            }
                        ]
                    }
                }
            });

            // Increment Journal Sequence
            if (settings) {
                await tx.companySettings.update({
                    where: { id: settings.id },
                    data: { journalCurrentNumber: { increment: 1 } }
                });
            }
        }
    });

    revalidatePath("/invoices");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to create payment:", error);
    return { error: error.message || "Failed to create payment" };
  }
}
