'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";

const prismaAny = prisma as any;

export async function getInvoicePromises(invoiceId: string) {
  if (!(await hasPermission("invoices.action.view"))) return [];
  const promises = await prismaAny.paymentPromise.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
  });
  return promises;
}

export async function setInvoicePromise(input: {
  invoiceId: string;
  promisedDate: string;
  promisedAmount?: number | null;
  remarks?: string | null;
}) {
  if (!(await hasPermission("invoices.paymentPromise.manage"))) return { error: "Not allowed" };
  const invoiceId = input.invoiceId;
  const promisedDate = input.promisedDate ? new Date(input.promisedDate) : null;
  if (!invoiceId) return { error: "Invoice is required" };
  if (!promisedDate) return { error: "Promised date is required" };

  const promisedAmount =
    input.promisedAmount === null || input.promisedAmount === undefined
      ? null
      : Math.max(0, Number(input.promisedAmount));

  try {
    await prismaAny.$transaction(async (tx: any) => {
      await tx.paymentPromise.updateMany({
        where: { invoiceId, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      });

      await tx.paymentPromise.create({
        data: {
          invoiceId,
          promisedDate,
          promisedAmount,
          remarks: input.remarks || null,
          status: "ACTIVE",
        },
      });
    });

    revalidatePath("/invoices");
    revalidatePath("/reports");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save promise" };
  }
}
