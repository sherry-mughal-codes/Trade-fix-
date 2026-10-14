'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/rbac"
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db"

// Currency Actions
export async function getCurrencies() {
  const organizationId = await requireOrganizationId()
  return await prisma.currency.findMany({ where: { organizationId }, orderBy: { code: 'asc' } })
}

export async function createCurrency(data: { code: string; name: string; symbol: string }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await prisma.currency.create({
      data: {
        organizationId,
        code: data.code.toUpperCase(),
        name: data.name,
        symbol: data.symbol,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create currency" }
  }
}

export async function updateCurrency(id: string, data: { code: string; name: string; symbol: string }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await requireOwnedRecord(prisma.currency, id, organizationId)
    await prisma.currency.update({
      where: { id },
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        symbol: data.symbol,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to update currency" }
  }
}

export async function deleteCurrency(id: string) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await requireOwnedRecord(prisma.currency, id, organizationId)
    await prisma.currency.delete({ where: { id } })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete currency" }
  }
}

// Item Actions
export async function getItems() {
  const organizationId = await requireOrganizationId()
  return await prisma.item.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
}

export async function createItem(data: { name: string; description: string }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await prisma.item.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create item" }
  }
}

export async function updateItem(id: string, data: { name: string; description: string }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await requireOwnedRecord(prisma.item, id, organizationId)
    await prisma.item.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to update item" }
  }
}

export async function deleteItem(id: string) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await requireOwnedRecord(prisma.item, id, organizationId)
    await prisma.item.delete({ where: { id } })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete item" }
  }
}

// Account Actions
export async function getAccounts() {
  const organizationId = await requireOrganizationId()
  return await prisma.account.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
}

export async function createAccount(data: { name: string; code: string; type: string; parentId?: string; isGroup?: boolean }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    if (data.code) {
      const existingAccount = await prisma.account.findFirst({
        where: withOrganization(organizationId, { code: data.code })
      });
      if (existingAccount) {
        throw new Error(`Account code "${data.code}" already exists.`);
      }
    }

    await prisma.account.create({
      data: {
        name: data.name,
        organizationId,
        code: data.code,
        type: data.type,
        parentId: data.parentId || null,
        isGroup: data.isGroup || false,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to create account" }
  }
}

export async function updateAccount(id: string, data: { name: string; code: string; type: string; parentId?: string; isGroup?: boolean }) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    if (data.code) {
      const existingAccount = await prisma.account.findFirst({
        where: withOrganization(organizationId, {
          code: data.code,
          NOT: { id }
        })
      });
      if (existingAccount) {
        throw new Error(`Account code "${data.code}" already exists.`);
      }
    }

    await requireOwnedRecord(prisma.account, id, organizationId)
    await prisma.account.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        parentId: data.parentId || null,
        isGroup: data.isGroup || false,
      },
    })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to update account" }
  }
}

export async function deleteAccount(id: string) {
  if (!(await hasPermission("settings.data.access"))) return { error: "Not allowed" }
  const organizationId = await requireOrganizationId()
  try {
    await requireOwnedRecord(prisma.account, id, organizationId)
    await prisma.account.delete({ where: { id } })
    revalidatePath("/data-settings")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete account" }
  }
}
