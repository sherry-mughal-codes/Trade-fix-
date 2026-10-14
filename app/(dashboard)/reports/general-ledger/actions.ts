
"use server";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

export async function getAccounts() {
  if (!(await hasPermission("reports.generalLedger"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
    const accounts = await prisma.account.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        isGroup: true,
      },
    });
    return { success: true, data: accounts };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function getParties(type?: string) {
    if (!(await hasPermission("reports.generalLedger"))) return { success: false, error: "Not allowed" };
    try {
        const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
        const where: any = { organizationId };
        if (type && type !== 'all') {
            if (type === 'customer') where.type = { in: ['customer', 'both'] };
            else if (type === 'supplier') where.type = { in: ['supplier', 'both'] };
        }

        const parties = await prisma.party.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, type: true }
        });
        return { success: true, data: parties };
    } catch (error) {
        return { success: false, error: "Failed to fetch parties" };
    }
}

export async function getEmployees() {
  if (!(await hasPermission("reports.generalLedger"))) return { success: false, error: "Not allowed" };
    try {
        const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
        const employees = await prisma.employee.findMany({
            where: { organizationId, status: 'ACTIVE' },
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        });
        return { success: true, data: employees };
    } catch (error) {
        return { success: false, error: "Failed to fetch employees" };
    }
}

export async function getCompanySettings() {
  if (!(await hasPermission("reports.generalLedger"))) return { success: false, error: "Not allowed" };
    try {
        const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
        const settings = await prisma.companySettings.findFirst({
            where: {
                organizationId,
            },
            select: {
                defaultReceivableAccount: true,
                defaultPayableAccount: true,
                defaultSalaryPayableAccount: true
            }
        });
        return { success: true, data: settings };
    } catch (error) {
        return { success: false, error: "Failed to fetch settings" };
    }
}

export type GeneralLedgerFilter = {
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  partyType?: string; // 'CUSTOMER', 'SUPPLIER', 'EMPLOYEE'
  partyId?: string;
};

export async function getGeneralLedgerReport({
  accountId,
  startDate,
  endDate,
  partyType,
  partyId
}: GeneralLedgerFilter) {
  if (!(await hasPermission("reports.generalLedger"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
    // Fetch Company Settings for Base Currency
    const companySettings = await prisma.companySettings.findFirst({
      where: {
        organizationId,
      },
    });
    const baseCurrency = companySettings?.baseCurrency || "USD";

    const whereClause: any = {
      journalEntry: {
        organizationId,
      },
    };

    // Filter by Account
    if (accountId && accountId !== "all") {
      whereClause.accountId = accountId;
    }

    // Filter by Date Range for Transactions
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      whereClause.journalEntry.date = dateFilter;
    }

    // Filter by Party
    if (partyId && partyId !== "all") {
        if (!whereClause.journalEntry) whereClause.journalEntry = {};
        
        if (partyType === 'EMPLOYEE') {
            whereClause.journalEntry.OR = [
                { salarySlip: { employeeId: partyId } },
                { salaryPayment: { employeeId: partyId } }
            ];
        } else {
            // Customer or Supplier
            whereClause.journalEntry.OR = [
                { invoice: { partyId: partyId } },
                { payment: { partyId: partyId } }
            ];
        }
    }

    // 1. Calculate Opening Balance
    let openingBalance = 0;
    let accountType = "";

    // Only calculate opening balance if a specific account is selected and a start date is provided
    if (accountId && accountId !== "all") {
      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          organizationId,
        },
        select: { type: true },
      });
      
      if (account) {
        accountType = account.type;
        
        if (startDate) {
            const openingWhere: any = {
                accountId: accountId,
                journalEntry: {
                    organizationId,
                    date: {
                        lt: startDate
                    }
                }
            };

            // Apply Party Filter to Opening Balance as well
            if (partyId && partyId !== "all") {
                if (partyType === 'EMPLOYEE') {
                    openingWhere.journalEntry.OR = [
                        { salarySlip: { employeeId: partyId } },
                        { salaryPayment: { employeeId: partyId } }
                    ];
                } else {
                    openingWhere.journalEntry.OR = [
                        { invoice: { partyId: partyId } },
                        { payment: { partyId: partyId } }
                    ];
                }
            }

            const openingRows = await prisma.journalRow.aggregate({
                where: openingWhere,
                _sum: {
                    debit: true,
                    credit: true,
                },
            });

            const totalDebit = openingRows._sum.debit || 0;
            const totalCredit = openingRows._sum.credit || 0;

            // Normal Balance logic
            if (['ASSET', 'EXPENSE'].includes(account.type)) {
                openingBalance = totalDebit - totalCredit;
            } else {
                openingBalance = totalCredit - totalDebit;
            }
        }
      }
    }

    // 2. Fetch Transactions
    const transactions = await prisma.journalRow.findMany({
      where: whereClause,
      include: {
        journalEntry: {
          include: {
            invoice: {
               select: {
                   currency: true,
                   exchangeRate: true,
                   grandTotal: true, // Original Amount
                   party: { select: { name: true } }
               }
            },
            payment: {
                select: {
                    party: {
                        select: {
                            name: true,
                            currency: true
                        }
                    }
                }
            },
            salarySlip: {
                select: {
                    employee: { select: { name: true } }
                }
            },
            salaryPayment: {
                select: {
                    employee: { select: { name: true } }
                }
            }
          }
        },
        account: true,
      },
      orderBy: [
        {
          journalEntry: {
            date: "asc",
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });

    // Process transactions to include currency info
    const processedTransactions = transactions.map(t => {
        let currency = baseCurrency;
        let partyName = "";

        if (t.journalEntry.invoice) {
            currency = t.journalEntry.invoice.currency;
            partyName = t.journalEntry.invoice.party.name;
        } else if (t.journalEntry.payment?.party) {
             currency = t.journalEntry.payment.party.currency;
             partyName = t.journalEntry.payment.party.name;
        } else if (t.journalEntry.salarySlip) {
            partyName = t.journalEntry.salarySlip.employee.name;
        } else if (t.journalEntry.salaryPayment) {
            partyName = t.journalEntry.salaryPayment.employee.name;
        }

        return {
            ...t,
            currency,
            partyName
        };
    });

    return {
      success: true,
      data: {
        openingBalance,
        transactions: processedTransactions,
        accountType,
        baseCurrency
      },
    };
  } catch (error) {
    console.error("Error fetching general ledger:", error);
    return { success: false, error: "Failed to fetch report data" };
  }
}
