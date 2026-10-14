'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getPermissionContext } from "@/lib/rbac"
import { requireOrganizationContext } from "@/lib/tenancy"

const prismaAny = prisma as any

export async function updateCompanySettings(formData: FormData) {
  const ctx = await getPermissionContext()
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!
  const canUpdate = ctx.isAuthenticated && (ctx.isSuperadmin || ctx.permissions.includes("settings.company.update"))
  if (!canUpdate) return { error: "Not allowed" }

  const companyName = formData.get("companyName") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const taxId = formData.get("taxId") as string
  const baseCurrency = formData.get("baseCurrency") as string
  const dateFormat = formData.get("dateFormat") as string
  const logoUrl = formData.get("logoUrl") as string
  const lightLogoUrl = formData.get("lightLogoUrl") as string
  const iconUrl = formData.get("iconUrl") as string
  const darkIconUrl = formData.get("darkIconUrl") as string
  const invoiceTerms = (formData.get("invoiceTerms") as string) || null
  const allowNegativeStock = formData.get("allowNegativeStock") === "on"

  if (!ctx.isSuperadmin) {
    try {
      const existingSettings = await prismaAny.companySettings.findFirst({ where: { organizationId } })
      if (!existingSettings) return { error: "Only superadmin can initialize company settings" }

      await prismaAny.companySettings.update({
        where: { id: existingSettings.id },
        data: {
          companyName: companyName || existingSettings.companyName,
          email,
          phone,
          address,
          taxId,
          baseCurrency: baseCurrency || existingSettings.baseCurrency,
          dateFormat: dateFormat || existingSettings.dateFormat,
          logoUrl,
          lightLogoUrl,
          iconUrl,
          darkIconUrl,
          invoiceTerms,
          allowNegativeStock,
        },
      })

      revalidatePath("/settings")
      return { success: true }
    } catch (error) {
      console.error("Failed to update settings:", error)
      if (error instanceof Error) {
        return { error: `Failed to update settings: ${error.message}` }
      }
      return { error: "Failed to update settings" }
    }
  }

  const invoicePrefix = (formData.get("invoicePrefix") as string) || ""
  const invoiceStartNumber = parseInt(formData.get("invoiceStartNumber") as string) || 1
  const invoiceCurrentNumber = parseInt(formData.get("invoiceCurrentNumber") as string) || 1
  const purchaseInvoicePrefix = (formData.get("purchaseInvoicePrefix") as string) || "PINV-"
  const purchaseInvoiceStartNumber = parseInt(formData.get("purchaseInvoiceStartNumber") as string) || 1
  const purchaseInvoiceCurrentNumber = parseInt(formData.get("purchaseInvoiceCurrentNumber") as string) || 1
  
  const journalPrefix = (formData.get("journalPrefix") as string) || ""
  const journalStartNumber = parseInt(formData.get("journalStartNumber") as string) || 1
  const journalCurrentNumber = parseInt(formData.get("journalCurrentNumber") as string) || 1

  const paymentPrefix = (formData.get("paymentPrefix") as string) || ""
  const paymentStartNumber = parseInt(formData.get("paymentStartNumber") as string) || 1
  const paymentCurrentNumber = parseInt(formData.get("paymentCurrentNumber") as string) || 1

  const defaultSalesAccount = (formData.get("defaultSalesAccount") as string) || null
  const defaultPurchaseAccount = (formData.get("defaultPurchaseAccount") as string) || null
  const defaultReceivableAccount = (formData.get("defaultReceivableAccount") as string) || null
  const defaultPayableAccount = (formData.get("defaultPayableAccount") as string) || null
  const defaultInventoryAssetAccount = (formData.get("defaultInventoryAssetAccount") as string) || null
  const defaultCogsAccount = (formData.get("defaultCogsAccount") as string) || null
  const defaultStockAdjustmentGainAccount = (formData.get("defaultStockAdjustmentGainAccount") as string) || null
  const defaultStockAdjustmentLossAccount = (formData.get("defaultStockAdjustmentLossAccount") as string) || null
  const defaultOpeningStockAccount = (formData.get("defaultOpeningStockAccount") as string) || null
  const defaultCashGroupAccount = (formData.get("defaultCashGroupAccount") as string) || null
  const defaultBankGroupAccount = (formData.get("defaultBankGroupAccount") as string) || null
  const defaultExpenseGroupAccount = (formData.get("defaultExpenseGroupAccount") as string) || null

  const salaryDivisionDays = parseInt(formData.get("salaryDivisionDays") as string) || 30
  const defaultSalaryExpenseAccount = (formData.get("defaultSalaryExpenseAccount") as string) || null
  const defaultSalaryPayableAccount = (formData.get("defaultSalaryPayableAccount") as string) || null

  if (!companyName) {
    return { error: "Company Name is required" }
  }

  try {
    const existingSettings = await prismaAny.companySettings.findFirst({ where: { organizationId } })

    // Create a data object to avoid repetition
    const data = {
        organizationId,
        companyName,
        email,
        phone,
        address,
        taxId,
        baseCurrency,
        dateFormat,
        logoUrl,
        lightLogoUrl,
        iconUrl,
        darkIconUrl,
        invoicePrefix,
        invoiceStartNumber,
        invoiceCurrentNumber,
        purchaseInvoicePrefix,
        purchaseInvoiceStartNumber,
        purchaseInvoiceCurrentNumber,
        journalPrefix,
        journalStartNumber,
        journalCurrentNumber,
        paymentPrefix,
        paymentStartNumber,
        paymentCurrentNumber,
        invoiceTerms,
        allowNegativeStock,
        defaultSalesAccount,
        defaultPurchaseAccount,
        defaultReceivableAccount,
        defaultPayableAccount,
        defaultInventoryAssetAccount,
        defaultCogsAccount,
        defaultStockAdjustmentGainAccount,
        defaultStockAdjustmentLossAccount,
        defaultOpeningStockAccount,
        defaultCashGroupAccount,
        defaultBankGroupAccount,
        defaultExpenseGroupAccount,
        salaryDivisionDays,
        defaultSalaryExpenseAccount,
        defaultSalaryPayableAccount,
    }

    if (existingSettings) {
      await prismaAny.companySettings.update({
        where: { id: existingSettings.id },
        data,
      })
    } else {
      await prismaAny.companySettings.create({
        data,
      })
    }

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Failed to update settings:", error)
    // Detailed error logging
    if (error instanceof Error) {
        return { error: `Failed to update settings: ${error.message}` }
    }
    return { error: "Failed to update settings" }
  }
}
