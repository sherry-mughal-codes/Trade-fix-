"use server";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

type FlatAccount = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isGroup: boolean;
  type: string;
};

type SummaryRow = {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  amount: number;
};

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthBounds(month?: string) {
  const safeMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : getCurrentMonthValue();
  const [year, monthIndex] = safeMonth.split("-").map(Number);
  const startDate = new Date(year, monthIndex - 1, 1);
  const endDate = new Date(year, monthIndex, 0, 23, 59, 59, 999);

  return {
    month: safeMonth,
    startDate,
    endDate,
    monthLabel: startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

function sortSummaryRows(rows: SummaryRow[]) {
  return rows.sort((a, b) => {
    const codeA = a.accountCode || "";
    const codeB = b.accountCode || "";

    if (codeA !== codeB) {
      return codeA.localeCompare(codeB);
    }

    return a.accountName.localeCompare(b.accountName);
  });
}

function mapToSortedRows(summaryMap: Map<string, SummaryRow>) {
  return sortSummaryRows(Array.from(summaryMap.values())).filter((row) => row.amount > 0.0001);
}

function collectLeafAccounts(rootIds: string[], accounts: FlatAccount[]) {
  const childrenByParent = new Map<string, FlatAccount[]>();

  for (const account of accounts) {
    if (!account.parentId) continue;

    const siblings = childrenByParent.get(account.parentId) || [];
    siblings.push(account);
    childrenByParent.set(account.parentId, siblings);
  }

  const leafAccounts: FlatAccount[] = [];
  const visited = new Set<string>();
  const stack = [...rootIds];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = childrenByParent.get(currentId) || [];

    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);

      if (child.isGroup) {
        stack.push(child.id);
      } else {
        leafAccounts.push(child);
      }
    }
  }

  return sortSummaryRows(
    leafAccounts.map((account) => ({
      accountId: account.id,
      accountName: account.name,
      accountCode: account.code,
      amount: 0,
    }))
  ).map((row) => {
    const original = leafAccounts.find((account) => account.id === row.accountId)!;
    return original;
  });
}

function collectAccountIdsInTree(rootIds: string[], accounts: FlatAccount[]) {
  const childrenByParent = new Map<string, FlatAccount[]>();
  const allAccountIds = new Set(accounts.map((account) => account.id));
  const collectedIds = new Set<string>();

  for (const account of accounts) {
    if (!account.parentId) continue;

    const siblings = childrenByParent.get(account.parentId) || [];
    siblings.push(account);
    childrenByParent.set(account.parentId, siblings);
  }

  const stack = rootIds.filter((id) => allAccountIds.has(id));

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (collectedIds.has(currentId)) continue;

    collectedIds.add(currentId);

    const children = childrenByParent.get(currentId) || [];
    for (const child of children) {
      stack.push(child.id);
    }
  }

  return collectedIds;
}

export async function getCashFlowStatement(month?: string) {
  if (!(await hasPermission("reports.generalLedger"))) {
    return { success: false, error: "Not allowed" };
  }

  try {
    const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
    const { month: selectedMonth, startDate, endDate, monthLabel } = getMonthBounds(month);

    const companySettings = await prisma.companySettings.findFirst({
      where: {
        organizationId,
      },
      select: {
        baseCurrency: true,
        defaultCashGroupAccount: true,
        defaultBankGroupAccount: true,
        defaultExpenseGroupAccount: true,
      },
    });

    const baseCurrency = companySettings?.baseCurrency || "USD";
    const cashGroupId = companySettings?.defaultCashGroupAccount || null;
    const bankGroupId = companySettings?.defaultBankGroupAccount || null;
    const expenseGroupId = companySettings?.defaultExpenseGroupAccount || null;

    if (!cashGroupId && !bankGroupId) {
      return {
        success: false,
        error: "Default cash and bank group accounts are not configured in Settings.",
      };
    }

    const accounts = await prisma.account.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        isGroup: true,
        type: true,
      },
    });

    const cashAccounts = cashGroupId ? collectLeafAccounts([cashGroupId], accounts) : [];
    const bankAccounts = bankGroupId ? collectLeafAccounts([bankGroupId], accounts) : [];
    const cashAccountIds = cashGroupId ? collectAccountIdsInTree([cashGroupId], accounts) : new Set<string>();
    const bankAccountIds = bankGroupId ? collectAccountIdsInTree([bankGroupId], accounts) : new Set<string>();
    const expenseAccountIds = expenseGroupId ? collectAccountIdsInTree([expenseGroupId], accounts) : new Set<string>();

    const cashAndBankAccountIds = Array.from(
      new Set([...Array.from(cashAccountIds), ...Array.from(bankAccountIds)])
    );

    if (cashAndBankAccountIds.length === 0) {
      return {
        success: false,
        error: "No child cash or bank accounts were found under the configured group accounts.",
      };
    }

    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        rows: {
          some: {
            accountId: {
              in: cashAndBankAccountIds,
            },
          },
        },
      },
      include: {
        rows: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    const bankInMap = new Map<string, SummaryRow>();
    const cashInMap = new Map<string, SummaryRow>();
    const expenseMap = new Map<string, SummaryRow>();

    for (const entry of journalEntries) {
      let cashBackedCredits = 0;
      let totalCredits = 0;

      for (const row of entry.rows) {
        totalCredits += row.credit;

        if (cashAccountIds.has(row.accountId) || bankAccountIds.has(row.accountId)) {
          cashBackedCredits += row.credit;
        }

        if (bankAccountIds.has(row.accountId) && row.debit > 0) {
          const existing = bankInMap.get(row.accountId);
          if (existing) {
            existing.amount += row.debit;
          } else {
            bankInMap.set(row.accountId, {
              accountId: row.account.id,
              accountName: row.account.name,
              accountCode: row.account.code,
              amount: row.debit,
            });
          }
        }

        if (cashAccountIds.has(row.accountId) && row.debit > 0) {
          const existing = cashInMap.get(row.accountId);
          if (existing) {
            existing.amount += row.debit;
          } else {
            cashInMap.set(row.accountId, {
              accountId: row.account.id,
              accountName: row.account.name,
              accountCode: row.account.code,
              amount: row.debit,
            });
          }
        }
      }

      if (cashBackedCredits <= 0 || totalCredits <= 0) {
        continue;
      }

      const cashExpenseRatio = Math.min(1, cashBackedCredits / totalCredits);

      for (const row of entry.rows) {
        const isEligibleExpense =
          row.account.type === "EXPENSE" &&
          row.debit > 0 &&
          (expenseAccountIds.size === 0 || expenseAccountIds.has(row.accountId));

        if (!isEligibleExpense) continue;

        const expenseAmount = row.debit * cashExpenseRatio;
        const existing = expenseMap.get(row.accountId);

        if (existing) {
          existing.amount += expenseAmount;
        } else {
          expenseMap.set(row.accountId, {
            accountId: row.account.id,
            accountName: row.account.name,
            accountCode: row.account.code,
            amount: expenseAmount,
          });
        }
      }
    }

    const bankInflows = mapToSortedRows(bankInMap);
    const cashInflows = mapToSortedRows(cashInMap);
    const expenseSummary = mapToSortedRows(expenseMap);

    const totalBankIn = bankInflows.reduce((sum, row) => sum + row.amount, 0);
    const totalCashIn = cashInflows.reduce((sum, row) => sum + row.amount, 0);
    const totalIn = totalBankIn + totalCashIn;
    const totalExpenses = expenseSummary.reduce((sum, row) => sum + row.amount, 0);
    const difference = totalIn - totalExpenses;

    return {
      success: true,
      data: {
        month: selectedMonth,
        monthLabel,
        baseCurrency,
        bankInflows,
        cashInflows,
        expenseSummary,
        totalBankIn,
        totalCashIn,
        totalIn,
        totalExpenses,
        difference,
      },
    };
  } catch (error) {
    console.error("Error fetching cash flow statement:", error);
    return { success: false, error: "Failed to fetch cash flow statement" };
  }
}
