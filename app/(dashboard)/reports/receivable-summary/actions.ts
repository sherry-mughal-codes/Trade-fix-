"use server";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

export async function getReceivableSummary() {
  if (!(await hasPermission("reports.receivableSummary"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

    const companySettings = await prisma.companySettings.findFirst({
      where: {
        organizationId,
      },
    });
    const baseCurrency = companySettings?.baseCurrency || "USD";

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        type: "SALE",
        status: { notIn: ["DRAFT", "CANCELLED"] },
        balanceAmount: { gt: 0 },
      },
      include: {
        party: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { date: "desc" },
      ],
    });

    const summaryMap = new Map<string, {
      partyId: string;
      partyName: string;
      currency: string;
      totalInvoiced: number; // Base Currency
      totalPaid: number;     // Base Currency
      balanceDue: number;    // Base Currency
      invoiceCount: number;
      
      foreignTotalInvoiced: number;
      foreignTotalPaid: number;
      foreignBalanceDue: number;
      lastInvoiceDate: Date | null;
      dueThisMonth: number; // Base Currency
      foreignDueThisMonth: number;
    }>();

    const groupInvoiceIds = new Map<string, Set<string>>();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    for (const invoice of invoices) {
        const party = invoice.party;
        const partyId = party?.id || "unknown";
        const partyName = party?.name || "Unknown Customer";
        const currency = invoice.currency || party?.currency || baseCurrency;
        const key = `${partyId}-${currency}`;
        const rate = Number(invoice.exchangeRate || 1);
        const baseGrandTotal = Number(invoice.baseGrandTotal || Number(invoice.grandTotal || 0) * rate);
        const basePaidAmount = Number(invoice.paidAmount || 0) * rate;
        const baseBalanceAmount = Number(invoice.balanceAmount || 0) * rate;

        if (!groupInvoiceIds.has(key)) {
            groupInvoiceIds.set(key, new Set());
        }
        groupInvoiceIds.get(key)?.add(invoice.id);

        let existing = summaryMap.get(key);
        if (!existing) {
            existing = {
                partyId,
                partyName,
                currency,
                totalInvoiced: 0,
                totalPaid: 0,
                balanceDue: 0,
                invoiceCount: 0,
                foreignTotalInvoiced: 0,
                foreignTotalPaid: 0,
                foreignBalanceDue: 0,
                lastInvoiceDate: null,
                dueThisMonth: 0,
                foreignDueThisMonth: 0,
            };
            summaryMap.set(key, existing);
        }

        const invoiceDate = invoice.date ? new Date(invoice.date) : null;
        if (invoiceDate && (!existing.lastInvoiceDate || invoiceDate > existing.lastInvoiceDate)) {
            existing.lastInvoiceDate = invoiceDate;
        }

        existing.totalInvoiced += baseGrandTotal;
        existing.totalPaid += basePaidAmount;
        existing.balanceDue += baseBalanceAmount;

        if (currency !== baseCurrency) {
            existing.foreignTotalInvoiced += Number(invoice.grandTotal || 0);
            existing.foreignTotalPaid += Number(invoice.paidAmount || 0);
            existing.foreignBalanceDue += Number(invoice.balanceAmount || 0);
        }

        if (invoice.dueDate) {
            const dueDate = new Date(invoice.dueDate);
            if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
                existing.dueThisMonth += baseBalanceAmount;
                if (currency !== baseCurrency) {
                    existing.foreignDueThisMonth += Number(invoice.balanceAmount || 0);
                }
            }
        }
    }

    const summary = Array.from(summaryMap.values())
        .map((item) => {
             const uniqueKey = `${item.partyId}-${item.currency}`;
             return {
                ...item,
                uniqueKey, 
                invoiceCount: groupInvoiceIds.get(uniqueKey)?.size || 0
            };
        })
        .filter(item => Math.abs(item.balanceDue) > 0.01)
        .sort((a, b) => {
            if (a.lastInvoiceDate && b.lastInvoiceDate) {
                return b.lastInvoiceDate.getTime() - a.lastInvoiceDate.getTime();
            }
            if (a.lastInvoiceDate) return -1;
            if (b.lastInvoiceDate) return 1;
            
            return b.balanceDue - a.balanceDue;
        });

    const totalReceivable = summary.reduce((sum, item) => sum + item.balanceDue, 0);
    const totalDueThisMonth = summary.reduce((sum, item) => sum + item.dueThisMonth, 0);

    return {
      success: true,
      data: {
        summary,
        totalReceivable,
        totalDueThisMonth,
        baseCurrency
      },
    };
  } catch (error) {
    console.error("Error fetching receivable summary:", error);
    return { success: false, error: "Failed to fetch report data" };
  }
}
