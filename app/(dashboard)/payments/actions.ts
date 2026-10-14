'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hasPermission } from "@/lib/rbac"
import { requireOrganizationId } from "@/lib/tenant-db"

export async function createPayment(formData: FormData) {
  if (!(await hasPermission("payments.create"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  const data = {
    type: formData.get("type") as string,
    partyId: formData.get("partyId") as string,
    amount: parseFloat(formData.get("amount") as string),
    currency: formData.get("currency") as string,
    exchangeRate: parseFloat(formData.get("exchangeRate") as string),
    date: formData.get("date") as string,
    method: formData.get("method") as string,
    reference: formData.get("reference") as string,
    notes: formData.get("notes") as string,
    // Invoice handling
    invoicesData: formData.get("invoicesData") as string,
    invoiceId: (formData.get("invoiceId") as string) || null // Legacy single invoice
  };

  if (!data.partyId || !data.amount || !data.date || !data.method) {
    return { error: "Missing required fields" }
  }

    // Parse multiple invoices data
    let invoicesData: { id: string; amount: number }[] = [];
    if (data.invoicesData) {
        try {
            invoicesData = JSON.parse(data.invoicesData);
        } catch (e) {
            console.error("Failed to parse invoices data", e);
        }
    }

    // Legacy single invoice support fallback
    // Only push if invoiceId exists AND invoicesData is empty AND invoiceId is not "null" string
    if (data.invoiceId && data.invoiceId !== "null" && invoicesData.length === 0) {
        invoicesData.push({ id: data.invoiceId, amount: data.amount });
    }

  try {
    const settings = await prisma.companySettings.findFirst({ where: { organizationId } });
    const prefix = settings?.paymentPrefix || "PAY-";
    const nextNumber = settings?.paymentCurrentNumber || 1;
    const paymentNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

    await prisma.$transaction(async (tx: any) => {
        // 1. Create Payment Record
        // We link the FIRST invoice if multiple are selected, just to keep the legacy relation satisfied if it's required.
        // If the schema allows null invoiceId, we can leave it null or link primary.
        const primaryInvoiceId = invoicesData.length > 0 ? invoicesData[0].id : null;

        // Create data object first to filter undefined values if needed, 
        // but since we are using explicit fields, we just need to ensure we don't pass fields that don't exist.
        // Wait, did the migration `add_multicurrency_to_journal` add currency to Payment? 
        // No, it added to JournalEntry.
        // The Payment model has `currency` and `exchangeRate` in schema.prisma?
        // Yes: 
        // currency      String   @default("USD")
        // exchangeRate  Float    @default(1.0)
        // BUT, maybe the client generation hasn't picked it up if `prisma generate` wasn't run or something?
        // Or maybe I missed adding it to Payment in previous steps?
        // Let's check schema again.
        // Schema HAS it.
        // Maybe the error `Unknown argument currency` suggests the runtime client doesn't know about it.
        // I will re-run prisma generate.
        
        const paymentData: any = {
            organizationId,
            paymentNumber,
            type: data.type as any,
            partyId: data.partyId,
            amount: data.amount,
            date: new Date(data.date),
            method: data.method,
            reference: data.reference,
            notes: data.notes,
            invoiceId: primaryInvoiceId,
        };

        // Note: The `currency` and `exchangeRate` fields MUST be in the schema for this to work.
        // If they are in the schema but the client is throwing "Unknown argument", it usually means:
        // 1. Prisma Client is stale (need `npx prisma generate`)
        // 2. The database has the columns but schema.prisma doesn't match (unlikely here)
        // 3. Typescript definitions are outdated.
        
        // I will explicitly cast `paymentData` or use a different approach if generation fails.
        // But first, let's try to include them again since I regenerated the client.
        if (data.currency) paymentData.currency = data.currency;
        if (data.exchangeRate) paymentData.exchangeRate = data.exchangeRate;

        const payment = await tx.payment.create({
            data: paymentData
        });

        // 2. Update Balances for ALL selected invoices
        for (const invData of invoicesData) {
            if (invData.amount <= 0) continue;

            const invoice = await tx.invoice.findFirst({ where: { id: invData.id, organizationId } });
            if (invoice) {
                // Ensure we handle amounts correctly (base vs foreign)
                // Payment amount is in foreign currency?
                // Invoice amounts are in foreign currency (grandTotal) and base (baseGrandTotal)
                // We should subtract the Payment Amount (FC) from Invoice Paid/Balance (FC)
                
                const newPaid = (invoice.paidAmount || 0) + invData.amount;
                const newBalance = (invoice.grandTotal || 0) - newPaid;
                
                // Allow a small margin of error for floating point
                const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'; 
                
                await tx.invoice.update({
                    where: { id: invData.id },
                    data: {
                        paidAmount: newPaid,
                        balanceAmount: newBalance,
                        status: newStatus
                    }
                });
            }
        }

        // 3. Update Sequence
        if (settings) {
            await tx.companySettings.update({
                where: { id: settings.id },
                data: { paymentCurrentNumber: { increment: 1 } }
            });
        } else {
            await tx.companySettings.create({
                data: {
                    organizationId,
                    companyName: "My Company",
                    paymentCurrentNumber: 2
                }
            });
        }

        // 4. Create Journal Entry
        // Determine accounts
        const accountId = formData.get("accountId") as string;
        
        let partyAccountId = "";
        const party = await tx.party.findFirst({ where: { id: data.partyId, organizationId } });
        
        // Find "Accounts Receivable" or "Accounts Payable"
        const accountName = data.type === "RECEIVE" ? "Accounts Receivable" : "Accounts Payable";
        
        // Note: settings object stores the ID or the Name? 
        // Based on schema `defaultReceivableAccount` is String? (e.g. "Accounts Receivable").
        // Usually it stores the ID if it's a relation, but schema comment says `// e.g., "Accounts Receivable"`.
        // Let's assume it might be ID or Name. 
        // Best practice is ID. But let's check if we can resolve it.
        
        let settingAccId = data.type === "RECEIVE" ? settings?.defaultReceivableAccount : settings?.defaultPayableAccount;
        
        if (settingAccId) {
             // Verify if it's a valid ID or Name
             const acc = await tx.account.findFirst({
                 where: {
                     organizationId,
                     OR: [
                         { id: settingAccId },
                         { name: settingAccId }
                     ]
                 }
             });
             if (acc) partyAccountId = acc.id;
        }
        
        // Fallback: Try finding by standard name if settings not set
        if (!partyAccountId) {
            const acc = await tx.account.findFirst({ where: { organizationId, name: accountName } });
            if (acc) {
                partyAccountId = acc.id;
            }
        }
        
        if (!partyAccountId) {
             throw new Error(`Default ${accountName} account is not configured in Company Settings. Please configure it first.`);
        }

        let debitAccountId = "";
        let creditAccountId = "";

        if (data.type === "RECEIVE") {
            debitAccountId = accountId; // Bank/Cash (Asset increase)
            creditAccountId = partyAccountId; // AR (Asset decrease)
        } else {
            debitAccountId = partyAccountId; // AP (Liability decrease)
            creditAccountId = accountId; // Bank/Cash (Asset decrease)
        }

        if (debitAccountId && creditAccountId) {
            const settings = await tx.companySettings.findFirst({ where: { organizationId } });
            const prefix = settings?.journalPrefix || "JRN-";
            let nextJrnNum = settings ? (settings.journalCurrentNumber + 1) : 1;
            const entryNumber = `${prefix}${nextJrnNum.toString().padStart(4, '0')}`;

            if (settings) {
                await tx.companySettings.update({
                    where: { id: settings.id },
                    data: { journalCurrentNumber: nextJrnNum }
                });
            }

            // Calculate Base Amount for Journal Entry (since Debit/Credit are base)
            const exRate = data.exchangeRate || 1.0;
            const baseAmount = data.amount * exRate;

            await tx.journalEntry.create({
                data: {
                    organizationId,
                    entryNumber,
                    date: new Date(data.date),
                    description: `Payment ${data.type === 'RECEIVE' ? 'from' : 'to'} ${party?.name || 'Party'} - ${data.reference || ''}`,
                    reference: paymentNumber,
                    currency: data.currency || 'USD',
                    exchangeRate: exRate,
                    payment: { connect: { id: payment.id } },
                    rows: {
                        create: [
                            {
                                organizationId,
                                accountId: debitAccountId,
                                debit: baseAmount,
                                credit: 0,
                                foreignDebit: data.amount,
                                foreignCredit: 0,
                                description: `Debit`
                            },
                            {
                                organizationId,
                                accountId: creditAccountId,
                                debit: 0,
                                credit: baseAmount,
                                foreignDebit: 0,
                                foreignCredit: data.amount,
                                description: `Credit`
                            }
                        ]
                    }
                }
            });
        } else {
             console.error("Missing Debit or Credit Account ID. Skipping Journal Entry.");
        }
    });

  } catch (error: any) {
    console.error("Failed to create payment:", error)
    return { error: error.message || "Failed to create payment" }
  }

  revalidatePath("/payments")
  redirect("/payments")
}

export async function updatePayment(id: string, formData: FormData) {
  if (!(await hasPermission("payments.action.edit"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  const type = formData.get("type") as string
  const partyId = formData.get("partyId") as string
  const amount = parseFloat(formData.get("amount") as string)
  const date = formData.get("date") as string
  const method = formData.get("method") as string
  const reference = formData.get("reference") as string
  const notes = formData.get("notes") as string
  const invoiceId = (formData.get("invoiceId") as string) || null

  if (!partyId || !amount || !date || !method) {
    return { error: "Missing required fields" }
  }

  try {
    await prisma.$transaction(async (tx: any) => {
        // Get old payment to revert changes if invoice link changed
        const oldPayment = await tx.payment.findFirst({ where: { id, organizationId } });
        
        // 1. Revert effect of old payment on old invoice (if any)
        if (oldPayment?.invoiceId) {
            const oldInvoice = await tx.invoice.findFirst({ where: { id: oldPayment.invoiceId, organizationId } });
            if (oldInvoice) {
                const revertedPaidAmount = oldInvoice.paidAmount - oldPayment.amount;
                const revertedBalance = oldInvoice.grandTotal - revertedPaidAmount;
                // Determine status (simplified)
                const revertedStatus = revertedBalance >= oldInvoice.grandTotal ? 'SENT' : (revertedBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID');
                
                await tx.invoice.update({
                    where: { id: oldPayment.invoiceId },
                    data: {
                        paidAmount: revertedPaidAmount,
                        balanceAmount: revertedBalance,
                        status: revertedStatus // Note: Ideally should revert to previous status, but logic is complex
                    }
                });
            }
        }

        // 2. Update Payment
        await tx.payment.update({
            where: { id },
            data: {
                type,
                partyId,
                amount,
                date: new Date(date),
                method,
                reference,
                notes,
                invoiceId
            }
        });

        // 3. Apply effect of new payment on new invoice (if any)
        if (invoiceId) {
            const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId } });
            if (invoice) {
                const newPaidAmount = invoice.paidAmount + amount;
                const newBalance = invoice.grandTotal - newPaidAmount;
                const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

                await tx.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        paidAmount: newPaidAmount,
                        balanceAmount: newBalance,
                        status: newStatus
                    }
                });
            }
        }
    });

  } catch (error: any) {
    console.error("Failed to update payment:", error)
    return { error: error.message || "Failed to update payment" }
  }

  revalidatePath("/payments")
  redirect("/payments")
}

export async function deletePayment(id: string) {
  if (!(await hasPermission("payments.action.delete"))) throw new Error("Not allowed")
  const organizationId = await requireOrganizationId()
  try {
    await prisma.$transaction(async (tx: any) => {
        // 1. Get Payment details before deletion
        const payment = await tx.payment.findFirst({
            where: { id, organizationId },
            include: { journalEntry: true }
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        // 2. Revert Invoice Stats (if linked)
        if (payment.invoiceId) {
            const invoice = await tx.invoice.findFirst({ where: { id: payment.invoiceId, organizationId } });
            if (invoice) {
                const revertedPaidAmount = invoice.paidAmount - payment.amount;
                const revertedBalance = invoice.grandTotal - revertedPaidAmount;
                // Determine status
                // If balance equals grand total (paid amount is 0 or less), it's back to SENT (assuming it was posted)
                // Note: If original status was PARTIALLY_PAID, it might go back to SENT or stay PARTIALLY_PAID if there are other payments.
                const revertedStatus = revertedBalance >= invoice.grandTotal ? 'SENT' : (revertedBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID');
                
                await tx.invoice.update({
                    where: { id: payment.invoiceId },
                    data: {
                        paidAmount: revertedPaidAmount,
                        balanceAmount: revertedBalance,
                        status: revertedStatus
                    }
                });
            }
        }

        // 3. Delete Linked Journal Entry (if any)
        if (payment.journalEntryId) {
             // To delete the JournalEntry first, we must first break the relationship because Payment has a foreign key to JournalEntry.
             // Otherwise, deleting JournalEntry will fail due to foreign key constraint (if not CASCADE) or we can't delete it while Payment points to it.
             
             // Step 3a: Remove reference from Payment
             await tx.payment.update({
                 where: { id },
                 data: { journalEntryId: null }
             });

             // Step 3b: Delete the Journal Entry
             await tx.journalEntry.delete({
                 where: { id: payment.journalEntryId }
             });
        }

        // 4. Delete Payment
        await tx.payment.delete({
            where: { id }
        });
    });

    revalidatePath("/payments");
  } catch (error: any) {
    console.error("Failed to delete payment:", error);
    throw new Error(error.message || "Failed to delete payment");
  }
}
