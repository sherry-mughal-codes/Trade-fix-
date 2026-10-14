'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hasPermission } from "@/lib/rbac"
import { getNextJournalSequence } from "./numbering"
import { requireOrganizationId } from "@/lib/tenant-db"
import { clearInventoryForSource, rebuildInventoryForItems } from "@/lib/inventory"

const JOURNAL_CREATE_RETRY_LIMIT = 3

function isEntryNumberConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const prismaError = error as { code?: string; meta?: { target?: string[] | string } }
  const targets = prismaError.meta?.target
  const targetList = Array.isArray(targets) ? targets : [targets]

  return prismaError.code === "P2002" && targetList.includes("entryNumber")
}

export async function createJournalEntry(formData: FormData) {
  if (!(await hasPermission("journal.create"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  const date = formData.get("date") as string
  const reference = formData.get("reference") as string
  const description = formData.get("description") as string
  const currency = formData.get("currency") as string || "USD"
  const exchangeRate = parseFloat(formData.get("exchangeRate") as string) || 1.0
  const rowsData = formData.get("rowsData") as string

  if (!date) {
    return { error: "Date is required" }
  }

  const rows = JSON.parse(rowsData);
  
  if (!rows || rows.length < 2) {
    return { error: "Journal entry must have at least 2 rows" }
  }

  // Validate balance in BASE currency
  const totalDebit = rows.reduce((sum: number, row: any) => sum + (Number(row.debit) || 0), 0);
  const totalCredit = rows.reduce((sum: number, row: any) => sum + (Number(row.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: "Journal entry must be balanced" }
  }

  try {
    let created = false

    for (let attempt = 0; attempt < JOURNAL_CREATE_RETRY_LIMIT; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          const settings = await tx.companySettings.findFirst({
            where: { organizationId },
            select: {
              id: true,
              companyName: true,
              journalPrefix: true,
              journalStartNumber: true,
              journalCurrentNumber: true,
            }
          })

          const prefix = settings?.journalPrefix || "JRN-"
          const existingEntries = await tx.journalEntry.findMany({
            where: {
              organizationId,
              entryNumber: {
                startsWith: prefix,
              },
            },
            select: {
              entryNumber: true,
            },
          })

          const { entryNumber, nextNumber } = getNextJournalSequence(
            settings,
            existingEntries.map((entry) => entry.entryNumber),
          )

          await tx.journalEntry.create({
            data: {
              entryNumber,
              organizationId,
              date: new Date(date),
              description,
              reference,
              currency,
              exchangeRate,
              rows: {
                create: rows.map((row: any) => ({
                  organizationId,
                  accountId: row.accountId,
                  description: row.description,
                  debit: Number(row.debit) || 0,
                  credit: Number(row.credit) || 0,
                  foreignDebit: Number(row.foreignDebit) || 0,
                  foreignCredit: Number(row.foreignCredit) || 0,
                }))
              }
            }
          })

          if (settings) {
            await tx.companySettings.update({
              where: { id: settings.id },
              data: { journalCurrentNumber: nextNumber + 1 }
            })
          } else {
            await tx.companySettings.create({
              data: {
                organizationId,
                companyName: "My Company",
                journalPrefix: prefix,
                journalCurrentNumber: nextNumber + 1,
              }
            })
          }
        })
        created = true
        break
      } catch (error) {
        if (isEntryNumberConflict(error) && attempt < JOURNAL_CREATE_RETRY_LIMIT - 1) {
          continue
        }

        throw error
      }
    }

    if (!created) {
      return { error: "Failed to create journal entry" }
    }
  } catch (error) {
    console.error("Failed to create journal entry:", error)
    return { error: "Failed to create journal entry" }
  }

  revalidatePath("/journal")
  redirect("/journal")
}

export async function deleteJournalEntry(id: string) {
  if (!(await hasPermission("journal.action.delete"))) throw new Error("Not allowed")
  const organizationId = await requireOrganizationId()
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
      include: {
        invoice: true,
        inventoryInvoice: true,
        payment: true,
        stockEntry: true,
        stockAdjustment: true,
        salarySlip: true,
        salaryPayment: true,
      }
    });

    if (!entry) {
        throw new Error("Journal entry not found");
    }

    if (entry.payment) {
        throw new Error(`Please Delete the linked Payment Entry ${entry.payment.paymentNumber}`);
    }

    if (entry.salaryPayment) {
        throw new Error(`Please Delete the linked Salary Payment ${entry.salaryPayment.paymentNumber} from Salary Payments module.`);
    }

    if (entry.stockEntry) {
        throw new Error(`Please use Stock Entry ${entry.stockEntry.entryNumber} to manage this posting.`);
    }

    if (entry.stockAdjustment) {
        throw new Error(`Please use Stock Adjustment ${entry.stockAdjustment.adjustmentNumber} to manage this posting.`);
    }

    if (entry.inventoryInvoice) {
        throw new Error(`Please change Invoice ${entry.inventoryInvoice.invoiceNumber} status instead of deleting its inventory journal.`);
    }

    if (entry.salarySlip) {
      const slip = entry.salarySlip;
      const [otherPostedPayable, totalPaid] = await prisma.$transaction([
        prisma.salarySlip.aggregate({
          where: {
            organizationId,
            employeeId: slip.employeeId,
            status: "POSTED",
            id: { not: slip.id },
            journalEntryId: { not: null },
          },
          _sum: { finalPayableAmount: true },
        }),
        prisma.salaryPayment.aggregate({
          where: {
            organizationId,
            employeeId: slip.employeeId,
            status: "POSTED",
          },
          _sum: { amount: true },
        }),
      ]);

      const payableAfterDelete = otherPostedPayable._sum.finalPayableAmount || 0;
      const paid = totalPaid._sum.amount || 0;

      if (paid > payableAfterDelete) {
        throw new Error("Cannot delete salary journal entry: payments have already been made against this salary slip. Please delete or revert the salary payments first.");
      }

      await prisma.$transaction(async (tx) => {
        await tx.salarySlip.delete({
          where: { id: slip.id },
        });
        await tx.journalEntry.delete({
          where: { id },
        });
      });

      revalidatePath("/journal");
      revalidatePath("/hr/salary-process");
      revalidatePath("/hr/salary-payment");
      revalidatePath("/hr/salary-bulk-payment");
      return;
    }

    // Allow deleting invoice-linked entries but revert invoice status
    if (entry.invoice) {
      const invoiceId = entry.invoice.id;
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          select: {
            id: true,
            inventoryJournalEntryId: true,
          },
        });

        const affectedItemIds = await clearInventoryForSource(tx, organizationId, "INVOICE", invoiceId);

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            journalEntryId: null,
            inventoryJournalEntryId: null,
            status: "DRAFT",
          },
        });

        if (invoice?.inventoryJournalEntryId) {
          await tx.journalEntry.delete({
            where: { id: invoice.inventoryJournalEntryId }
          });
        }

        await tx.journalEntry.delete({
          where: { id }
        });

        if (affectedItemIds.length) {
          await rebuildInventoryForItems(tx, organizationId, affectedItemIds);
        }
      });
    } else {
        await prisma.journalEntry.delete({
            where: { id },
        });
    }

    revalidatePath("/journal");
    revalidatePath("/hr/salary-process");
    revalidatePath("/hr/salary-payment");
    revalidatePath("/hr/salary-bulk-payment");
    revalidatePath("/invoices");
    revalidatePath("/inventory");
    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/ledger");
    revalidatePath("/items");
  } catch (error) {
    console.error("Failed to delete journal entry:", error);
    throw error;
  }
}

export async function updateJournalEntry(id: string, formData: FormData) {
  if (!(await hasPermission("journal.action.edit"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  const date = formData.get("date") as string
  const reference = formData.get("reference") as string
  const description = formData.get("description") as string
  const currency = formData.get("currency") as string || "USD"
  const exchangeRate = parseFloat(formData.get("exchangeRate") as string) || 1.0
  const rowsData = formData.get("rowsData") as string

  if (!date) {
    return { error: "Date is required" }
  }

  const rows = JSON.parse(rowsData);
  
  if (!rows || rows.length < 2) {
    return { error: "Journal entry must have at least 2 rows" }
  }

  // Validate balance
  const totalDebit = rows.reduce((sum: number, row: any) => sum + (Number(row.debit) || 0), 0);
  const totalCredit = rows.reduce((sum: number, row: any) => sum + (Number(row.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: "Journal entry must be balanced" }
  }

  try {
    // Check if linked
    const existingEntry = await prisma.journalEntry.findFirst({
        where: { id, organizationId },
        include: {
          invoice: true,
          inventoryInvoice: true,
          payment: true,
          stockEntry: true,
          stockAdjustment: true,
        }
    });

    if (existingEntry?.invoice || existingEntry?.inventoryInvoice || existingEntry?.payment || existingEntry?.stockEntry || existingEntry?.stockAdjustment) {
        return { error: "Cannot edit journal entry linked to a source document" }
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing rows
      await tx.journalRow.deleteMany({
        where: { journalEntryId: id }
      });

      // Update Entry and create new rows
      await tx.journalEntry.update({
        where: { id },
        data: {
          date: new Date(date),
          description,
          reference,
          currency,
          exchangeRate,
          rows: {
            create: rows.map((row: any) => ({
              organizationId,
              accountId: row.accountId,
              description: row.description,
              debit: Number(row.debit) || 0,
              credit: Number(row.credit) || 0,
              foreignDebit: Number(row.foreignDebit) || 0,
              foreignCredit: Number(row.foreignCredit) || 0,
            }))
          }
        }
      });
    });

  } catch (error) {
    console.error("Failed to update journal entry:", error)
    return { error: "Failed to update journal entry" }
  }

  revalidatePath("/journal")
  redirect("/journal")
}
