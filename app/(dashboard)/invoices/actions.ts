'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hasPermission } from "@/lib/rbac"
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db"
import { assertPartyMatchesInvoiceType, enforceCustomerCreditLimit } from "@/lib/credit-control"
import { clearInventoryForSource, rebuildInventoryForItems } from "@/lib/inventory"
import { updateInvoiceStatus } from "./status-actions"

export async function createInvoice(formData: FormData) {
  if (!(await hasPermission("invoices.create"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  // invoiceNumber is now auto-generated
  console.log("createInvoice called");
  
  const typeRaw = formData.get("type") as string
  let type = typeRaw === "SALES" ? "SALE" : typeRaw;
  
  const itemsJson = formData.get("itemsData") as string
  const items = itemsJson ? JSON.parse(itemsJson) : []
  
  console.log("Items received:", items);
  console.log("Date received:", formData.get("date"));
  console.log("PartyId received:", formData.get("partyId"));

  const submitAction = String(formData.get("submitAction") || "save").toLowerCase()
  const shouldSend = submitAction === "send"
  const status = shouldSend ? "DRAFT" : ((formData.get("status") as string) || "DRAFT")
  const date = formData.get("date") as string
  const dueDate = formData.get("dueDate") as string
  const partyId = formData.get("partyId") as string
  const currency = formData.get("currency") as string
  const exchangeRate = parseFloat(formData.get("exchangeRate") as string) || 1.0;
  const notes = formData.get("notes") as string
  const terms = formData.get("terms") as string

  if (!partyId) {
    return { error: "Party is required" }
  }
  if (!date) {
    return { error: "Date is required" }
  }
  if (items.length === 0) {
    return { error: "At least one item is required" }
  }
  if (items.some((item: any) => !item.itemId)) {
    return { error: "Please select an item for every invoice row" }
  }

  // Calculate totals
  const subTotal = items.reduce((sum: number, item: any) => {
    return sum + (Number(item.quantity) * Number(item.unitPrice))
  }, 0)
  
  const discountTotal = items.reduce((sum: number, item: any) => {
    return sum + Number(item.discount || 0)
  }, 0)

  const grandTotal = subTotal - discountTotal
  const balanceAmount = grandTotal // Assuming no initial payment
  const baseGrandTotal = grandTotal * exchangeRate;

  try {
    let createdInvoiceId = ""

    await prisma.$transaction(async (tx: any) => {
      await assertPartyMatchesInvoiceType(tx, organizationId, partyId, type)
      if (type === "SALE" && status !== "DRAFT") {
        await enforceCustomerCreditLimit(tx, organizationId, partyId, balanceAmount)
      }

      // 1. Get Company Settings for auto-generation
      let settings = await tx.companySettings.findFirst({ where: { organizationId } });
      
      if (!settings) {
        // Create default settings if not exists
        settings = await tx.companySettings.create({
          data: {
            organizationId,
            companyName: "My Company", // Default name
            invoicePrefix: "INV-",
            invoiceCurrentNumber: 1,
            purchaseInvoicePrefix: "PINV-",
            purchaseInvoiceCurrentNumber: 1,
          }
        });
      }

      const isPurchaseInvoice = type === "PURCHASE";
      const invoiceNumber = isPurchaseInvoice
        ? `${settings.purchaseInvoicePrefix || "PINV-"}${settings.purchaseInvoiceCurrentNumber || 1}`
        : `${settings.invoicePrefix}${settings.invoiceCurrentNumber}`;

      const resolvedItems = await Promise.all(
        items.map(async (item: any) => {
          const linkedItem = await tx.item.findFirst({
            where: {
              id: String(item.itemId),
              organizationId,
            },
          });

          if (!linkedItem) {
            throw new Error("Please select a valid item for every invoice row");
          }

          const batchNumber = item.batchNumber ? String(item.batchNumber) : null;
          const warehouseName = item.warehouseName ? String(item.warehouseName) : null;

          if (isPurchaseInvoice && linkedItem.trackBatches && !batchNumber) {
            throw new Error(`Please select a batch for ${linkedItem.name}`);
          }

          if (batchNumber) {
            const savedBatch = await tx.inventoryBatchMaster.findFirst({
              where: {
                organizationId,
                name: batchNumber,
                isActive: true,
              },
            });

            if (!savedBatch) {
              throw new Error(`Please select a valid batch for ${linkedItem.name}`);
            }
          }

          if (warehouseName) {
            const savedWarehouse = await tx.inventoryWarehouse.findFirst({
              where: {
                organizationId,
                name: warehouseName,
                isActive: true,
              },
            });

            if (!savedWarehouse) {
              throw new Error(`Please select a valid warehouse for ${linkedItem.name}`);
            }
          }

          return {
            itemId: linkedItem.id,
            description: linkedItem.name,
            moreDetails: item.moreDetails,
            batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            warehouseName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount || 0),
            amount: (Number(item.quantity) * Number(item.unitPrice)) - Number(item.discount || 0),
          };
        })
      );

      // 2. Create Invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          type,
          status,
          date: new Date(date),
          dueDate: dueDate ? new Date(dueDate) : null,
          partyId,
          currency,
          exchangeRate,
          notes,
          terms,
          subTotal,
          discountTotal,
          grandTotal,
          baseGrandTotal, 
          balanceAmount,
          items: {
            create: resolvedItems
          }
        },
      })
      createdInvoiceId = createdInvoice.id

      // 5. Create Journal Entry if status is not DRAFT
      // Auto-create Journal Entry for Sales/Purchase
      // Default Accounts from Settings
      /* 
       * MOVED TO status-actions.ts
       * Journal entries are now created when status changes to "SENT"
       * and deleted when status changes to "CANCELLED"
       */

      // 6. Increment Sequence
      await tx.companySettings.update({
        where: { id: settings.id },
        data: {
            ...(isPurchaseInvoice
              ? { purchaseInvoiceCurrentNumber: { increment: 1 } }
              : { invoiceCurrentNumber: { increment: 1 } })
        }
      });
    });

    if (shouldSend && createdInvoiceId) {
      const postResult = await updateInvoiceStatus(createdInvoiceId, "SENT")
      if (postResult?.error) {
        return { error: postResult.error }
      }
    }

  } catch (error) {
    console.error("Failed to create invoice:", error)
    return { error: `Failed to create invoice: ${error instanceof Error ? error.message : String(error)}` }
  }

  revalidatePath("/invoices")
  redirect("/invoices")
}

export async function updateInvoice(id: string, formData: FormData) {
  if (!(await hasPermission("invoices.action.edit"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  const typeRaw = formData.get("type") as string
  let type = typeRaw === "SALES" ? "SALE" : typeRaw;
  
  const submitAction = String(formData.get("submitAction") || "save").toLowerCase()
  const shouldSend = submitAction === "send"
  const status = formData.get("status") as string
  const date = formData.get("date") as string
  const dueDate = formData.get("dueDate") as string
  const partyId = formData.get("partyId") as string
  const currency = formData.get("currency") as string
  const exchangeRate = parseFloat(formData.get("exchangeRate") as string) || 1.0;
  const notes = formData.get("notes") as string
  const terms = formData.get("terms") as string
  
  const itemsJson = formData.get("itemsData") as string
  const items = itemsJson ? JSON.parse(itemsJson) : []

  if (!partyId) return { error: "Party is required" }
  if (!date) return { error: "Date is required" }
  if (items.length === 0) return { error: "At least one item is required" }
  if (items.some((item: any) => !item.itemId)) return { error: "Please select an item for every invoice row" }

  const subTotal = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0)
  const discountTotal = items.reduce((sum: number, item: any) => sum + Number(item.discount || 0), 0)
  const grandTotal = subTotal - discountTotal
  const baseGrandTotal = grandTotal * exchangeRate;
  
  // For update, we need to consider previously paid amount if any
  // But for now, let's assume balance is total - paid.
  // We need to fetch current paid amount first.
  
  try {
    let previousStatus = "DRAFT"
    let nextStatus = "DRAFT"

    await prisma.$transaction(async (tx: any) => {
        const currentInvoice = await tx.invoice.findFirst({ where: { id, organizationId } });
        if (!currentInvoice) throw new Error("Invoice not found");
        previousStatus = currentInvoice.status || "DRAFT";
        nextStatus = shouldSend ? "DRAFT" : (status || currentInvoice.status || "DRAFT");

        const balanceAmount = grandTotal - currentInvoice.paidAmount;
        await assertPartyMatchesInvoiceType(tx, organizationId, partyId, type);
        if (type === "SALE" && (currentInvoice.status !== "DRAFT" || (status && status !== "DRAFT"))) {
          await enforceCustomerCreditLimit(tx, organizationId, partyId, balanceAmount, id);
        }

        const resolvedItems = await Promise.all(
          items.map(async (item: any) => {
            const linkedItem = await tx.item.findFirst({
              where: {
                id: String(item.itemId),
                organizationId,
              },
            });

            if (!linkedItem) {
              throw new Error("Please select a valid item for every invoice row");
            }

            const isPurchaseInvoice = type === "PURCHASE";
            const batchNumber = item.batchNumber ? String(item.batchNumber) : null;
            const warehouseName = item.warehouseName ? String(item.warehouseName) : null;

            if (isPurchaseInvoice && linkedItem.trackBatches && !batchNumber) {
              throw new Error(`Please select a batch for ${linkedItem.name}`);
            }

            if (batchNumber) {
              const savedBatch = await tx.inventoryBatchMaster.findFirst({
                where: {
                  organizationId,
                  name: batchNumber,
                  isActive: true,
                },
              });

              if (!savedBatch) {
                throw new Error(`Please select a valid batch for ${linkedItem.name}`);
              }
            }

            if (warehouseName) {
              const savedWarehouse = await tx.inventoryWarehouse.findFirst({
                where: {
                  organizationId,
                  name: warehouseName,
                  isActive: true,
                },
              });

              if (!savedWarehouse) {
                throw new Error(`Please select a valid warehouse for ${linkedItem.name}`);
              }
            }

            return {
              itemId: linkedItem.id,
              description: linkedItem.name,
              moreDetails: item.moreDetails,
              batchNumber,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              warehouseName,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount || 0),
              amount: (Number(item.quantity) * Number(item.unitPrice)) - Number(item.discount || 0),
            };
          })
        );

        // Update Invoice
        await tx.invoice.update({
            where: { id },
            data: {
                type,
                status: nextStatus,
                date: new Date(date),
                dueDate: dueDate ? new Date(dueDate) : null,
                partyId,
                currency,
                exchangeRate,
                notes,
                terms,
                subTotal,
                discountTotal,
                grandTotal,
                baseGrandTotal,
                balanceAmount,
                // Delete existing items and create new ones
                items: {
                    deleteMany: {},
                    create: resolvedItems
                }
            }
        });
    });

    if (shouldSend) {
      const postResult = await updateInvoiceStatus(id, "SENT")
      if (postResult?.error) {
        return { error: postResult.error }
      }
    } else if (nextStatus !== "DRAFT" || previousStatus !== "DRAFT") {
      const postResult = await updateInvoiceStatus(id, nextStatus)
      if (postResult?.error) {
        return { error: postResult.error }
      }
    }
  } catch (error) {
    console.error("Failed to update invoice:", error)
    return { error: `Failed to update invoice: ${error instanceof Error ? error.message : String(error)}` }
  }

  revalidatePath("/invoices")
  revalidatePath(`/invoices/${id}`)
  redirect("/invoices")
}

export async function deleteInvoice(id: string) {
  if (!(await hasPermission("invoices.action.delete"))) throw new Error("Not allowed")
  const organizationId = await requireOrganizationId()
  try {
    await prisma.$transaction(async (tx: any) => {
        // 1. Get Invoice details
        const invoice = await tx.invoice.findFirst({
            where: { id, organizationId },
            include: { 
                payments: true,
                journalEntry: true,
                inventoryJournalEntry: true,
                stockMovements: {
                    select: {
                        itemId: true,
                    },
                },
            }
        });

        if (!invoice) throw new Error("Invoice not found");

        // 2. Delete Linked Journal Entry (if any)
        if (invoice.journalEntryId) {
             // Break link first
             await tx.invoice.update({
                 where: { id },
                 data: { journalEntryId: null }
             });
             await tx.journalEntry.delete({
                 where: { id: invoice.journalEntryId }
             });
        }

        if (invoice.inventoryJournalEntryId) {
             await tx.invoice.update({
                 where: { id },
                 data: { inventoryJournalEntryId: null }
             });
             await tx.journalEntry.delete({
                 where: { id: invoice.inventoryJournalEntryId }
             });
        }

        // 3. Delete Linked Payments (and their journal entries)
        if (invoice.payments && invoice.payments.length > 0) {
            for (const payment of invoice.payments) {
                // Delete payment's journal entry if exists
                if (payment.journalEntryId) {
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: { journalEntryId: null }
                    });
                    await tx.journalEntry.delete({
                        where: { id: payment.journalEntryId }
                    });
                }
                // Delete payment
                await tx.payment.delete({
                    where: { id: payment.id }
                });
            }
        }

        // 4. Remove posted inventory and rebuild affected items
        const inventoryItemIds = await clearInventoryForSource(tx, organizationId, "INVOICE", id);
        if (inventoryItemIds.length) {
            await rebuildInventoryForItems(tx, organizationId, inventoryItemIds);
        }

        // 5. Delete Invoice
        await tx.invoice.delete({
            where: { id }
        });
    });

    revalidatePath("/invoices");
    revalidatePath("/inventory");
    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/ledger");
    revalidatePath("/items");
  } catch (error: any) {
    console.error("Failed to delete invoice:", error);
    throw new Error(error.message || "Failed to delete invoice");
  }
}
