"use server";

import { prisma } from "@/lib/prisma";
import { getPermissionContext } from "@/lib/rbac";

export async function getDashboardStats() {
  const ctx = await getPermissionContext();
  const can = (key: string) => ctx.isSuperadmin || ctx.permissions.includes(key);
  if (!ctx.isAuthenticated || !can("dashboard.access")) return { forbidden: true };

  const rbac = {
    cardTotalDue: can("dashboard.card.totalDue"),
    cardDueThisMonth: can("dashboard.card.dueThisMonth"),
    cardProfitLoss: can("dashboard.card.profitLoss"),
    cardCashIn: can("dashboard.card.cashIn"),
    cardActiveAdmissions: can("dashboard.card.activeAdmissions"),
    cardDischargedAdmissions: can("dashboard.card.dischargedAdmissions"),
    chartCashflow: can("dashboard.chart.cashflowLast12Months"),
    chartInvoicedVsReceived: can("dashboard.chart.invoicedVsReceivedThisMonth"),
    sectionDueInvoices: can("dashboard.section.dueThisMonthInvoices"),
    sectionPayments: can("dashboard.section.paymentsThisMonth"),
  };

  try {
    const companySettings = await prisma.companySettings.findFirst();
    const baseCurrency = companySettings?.baseCurrency || "USD";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let totalDue = 0;
    let totalDueThisMonth = 0;
    let profitLoss = 0;
    let totalIn = 0;
    let totalOut = 0;
    let totalInvoicedThisMonth = 0;
    let totalEstimatedThisMonth = 0;
    let activeAdmissions = 0;
    let dischargedAdmissions = 0;
    let cashflowData: Array<{ name: string; in: number; out: number }> = [];
    let invoicesDueThisMonth: any[] = [];
    let paymentsThisMonth: any[] = [];

    const getCashAndBankAccountIds = async (fallback: boolean) => {
      const groupIds = [companySettings?.defaultCashGroupAccount, companySettings?.defaultBankGroupAccount].filter(
        Boolean
      ) as string[];

      if (groupIds.length > 0) {
        const accounts = await prisma.account.findMany({
          where: { parentId: { in: groupIds } },
          select: { id: true },
        });
        return accounts.map((a) => a.id);
      }

      if (!fallback) return [];

      const groupAccounts = await prisma.account.findMany({
        where: {
          OR: [{ code: "1100" }, { code: "1200" }],
          isGroup: true,
        },
        select: { id: true },
      });
      const fallbackGroupIds = groupAccounts.map((g) => g.id);
      if (fallbackGroupIds.length === 0) return [];

      const accounts = await prisma.account.findMany({
        where: { parentId: { in: fallbackGroupIds } },
        select: { id: true },
      });
      return accounts.map((a) => a.id);
    };

    if (rbac.cardTotalDue) {
      const allDueInvoices = await prisma.invoice.findMany({
        where: {
          type: "SALE",
          status: { notIn: ["CANCELLED", "DRAFT"] },
          balanceAmount: { gt: 0 },
        },
        select: {
          balanceAmount: true,
          exchangeRate: true,
          currency: true,
        },
      });

      totalDue = allDueInvoices.reduce((sum, inv) => {
        const rate = inv.exchangeRate || 1;
        return sum + inv.balanceAmount * rate;
      }, 0);
    }

    if (rbac.cardDueThisMonth) {
      const dueThisMonthInvoicesAgg = await prisma.invoice.findMany({
        where: {
          type: "SALE",
          status: { notIn: ["CANCELLED", "DRAFT"] },
          balanceAmount: { gt: 0 },
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          balanceAmount: true,
          exchangeRate: true,
        },
      });

      totalDueThisMonth = dueThisMonthInvoicesAgg.reduce((sum, inv) => {
        const rate = inv.exchangeRate || 1;
        return sum + inv.balanceAmount * rate;
      }, 0);
    }

    if (rbac.cardActiveAdmissions) {
      activeAdmissions = 0;
    }

    if (rbac.cardDischargedAdmissions) {
      dischargedAdmissions = 0;
    }

    if (rbac.sectionDueInvoices) {
      invoicesDueThisMonth = await prisma.invoice.findMany({
        where: {
          type: "SALE",
          status: { notIn: ["CANCELLED"] },
          balanceAmount: { gt: 0 },
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          party: {
            select: { name: true },
          },
          grandTotal: true,
          balanceAmount: true,
          exchangeRate: true,
          dueDate: true,
          currency: true,
          status: true,
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      });
    }

    const needTotalIn = rbac.cardCashIn || rbac.chartInvoicedVsReceived;
    if (needTotalIn) {
      const allInPayments = await prisma.payment.findMany({
        where: {
          type: "RECEIVE",
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          amount: true,
          exchangeRate: true,
        },
      });
      totalIn = allInPayments.reduce((sum, p) => sum + p.amount * (p.exchangeRate || 1), 0);
    }

    if (rbac.cardProfitLoss) {
      const cashAccountIds = await getCashAndBankAccountIds(true);
      if (cashAccountIds.length > 0) {
        const agg = await prisma.journalRow.aggregate({
          where: {
            accountId: { in: cashAccountIds },
            journalEntry: {
              date: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });
        const debit = agg._sum.debit || 0;
        const credit = agg._sum.credit || 0;
        profitLoss = debit - credit;
      } else {
        profitLoss = 0;
      }
    }

    if (rbac.sectionPayments) {
      paymentsThisMonth = await prisma.payment.findMany({
        where: {
          type: "RECEIVE",
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          id: true,
          paymentNumber: true,
          type: true,
          date: true,
          amount: true,
          currency: true,
          exchangeRate: true,
          party: {
            select: { name: true },
          },
        },
        orderBy: {
          date: "desc",
        },
        take: 10,
      });
    }

    if (rbac.chartCashflow) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);

      const cashAccountIds = await getCashAndBankAccountIds(true);

      const journalRows = await prisma.journalRow.findMany({
        where: {
          accountId: { in: cashAccountIds },
          journalEntry: {
            date: {
              gte: twelveMonthsAgo,
            },
          },
        },
        include: {
          journalEntry: {
            select: { date: true },
          },
        },
      });

      const monthlyCashflow = new Map<string, { name: string; in: number; out: number }>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(twelveMonthsAgo);
        d.setMonth(d.getMonth() + i);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const name = d.toLocaleString("default", { month: "short" });
        monthlyCashflow.set(key, { name, in: 0, out: 0 });
      }

      journalRows.forEach((row) => {
        const d = new Date(row.journalEntry.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthlyCashflow.has(key)) {
          const entry = monthlyCashflow.get(key)!;
          entry.in += row.debit;
          entry.out += row.credit;
        }
      });

      cashflowData = Array.from(monthlyCashflow.values());
    }

    if (rbac.chartInvoicedVsReceived) {
      totalEstimatedThisMonth = 0;
      const invoicedThisMonthAgg = await prisma.invoice.findMany({
        where: {
          type: "SALE",
          status: { notIn: ["CANCELLED", "DRAFT"] },
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          grandTotal: true,
          exchangeRate: true,
        },
      });
      totalInvoicedThisMonth = invoicedThisMonthAgg.reduce((sum, inv) => {
        const rate = inv.exchangeRate || 1;
        return sum + inv.grandTotal * rate;
      }, 0);
    }

    return {
      totalDue,
      totalDueThisMonth,
      profitLoss,
      totalIn,
      totalOut,
      activeAdmissions,
      dischargedAdmissions,
      invoicesDueThisMonth,
      paymentsThisMonth,
      cashflowData,
      totalInvoicedThisMonth,
      totalEstimatedThisMonth,
      baseCurrency,
      rbac,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return null;
  }
}
