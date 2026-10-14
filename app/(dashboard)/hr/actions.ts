"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { randomUUID } from "crypto";

async function hasAnyPermission(permissionKeys: string[]) {
  for (const permissionKey of permissionKeys) {
    if (await hasPermission(permissionKey)) {
      return true;
    }
  }
  return false;
}

export async function getAccounts() {
  if (
    !(await hasAnyPermission([
      "hr.access",
      "hr.employees.list",
      "hr.salary.process",
      "hr.salary.payments",
    ]))
  ) {
    return { success: false, error: "Not allowed" };
  }

  try {
    const organizationId = await requireOrganizationId();
    const [accounts, companySettings] = await Promise.all([
      prisma.account.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          subType: true,
          isGroup: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      prisma.companySettings.findFirst({
        where: { organizationId },
        select: { defaultCashGroupAccount: true, defaultBankGroupAccount: true },
      }),
    ]);

    let cashGroupAccountId: string | null = companySettings?.defaultCashGroupAccount || null;
    let bankGroupAccountId: string | null = companySettings?.defaultBankGroupAccount || null;

    if (!cashGroupAccountId || !bankGroupAccountId) {
      const fallbackGroups = await prisma.account.findMany({
        where: {
          organizationId,
          isGroup: true,
          OR: [
            { code: "1100" },
            { code: "1200" },
            { name: { equals: "Cash", mode: "insensitive" } },
            { name: { equals: "Bank", mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, name: true },
      });
      if (!cashGroupAccountId) {
        cashGroupAccountId =
          fallbackGroups.find(
            (a) => a.code === "1100" || a.name.toLowerCase() === "cash"
          )?.id || null;
      }
      if (!bankGroupAccountId) {
        bankGroupAccountId =
          fallbackGroups.find(
            (a) => a.code === "1200" || a.name.toLowerCase() === "bank"
          )?.id || null;
      }
    }

    return { success: true, data: accounts, cashGroupAccountId, bankGroupAccountId };
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function getEmployees() {
  if (
    !(await hasAnyPermission([
      "hr.access",
      "hr.employees.list",
      "hr.salary.process",
      "hr.salary.payments",
    ]))
  ) {
    return { success: false, error: "Not allowed" };
  }

  try {
    const organizationId = await requireOrganizationId();
    const employees = await prisma.employee.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return { success: true, data: employees };
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return { success: false, error: "Failed to fetch employees" };
  }
}

export async function createEmployee(data: any) {
  if (!(await hasPermission("hr.employees.create"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = await requireOrganizationId();
    const joinDate = data.joinDate ? new Date(`${data.joinDate}T00:00:00`) : new Date();
    if (Number.isNaN(joinDate.getTime())) {
      return { success: false, error: "Join date is invalid" };
    }
    const employee = await prisma.employee.create({
      data: {
        organizationId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        ctc: data.ctc,
        joinDate,
        status: data.status,
      },
    });
    revalidatePath("/hr/employees");
    return { success: true, data: employee };
  } catch (error) {
    console.error("Failed to create employee:", error);
    return { success: false, error: (error as Error).message || "Failed to create employee" };
  }
}

export async function updateEmployee(id: string, data: any) {
  if (!(await hasPermission("hr.employees.action.edit"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = await requireOrganizationId();
    await requireOwnedRecord(prisma.employee, id, organizationId);
    const joinDate = data.joinDate ? new Date(`${data.joinDate}T00:00:00`) : new Date();
    if (Number.isNaN(joinDate.getTime())) {
      return { success: false, error: "Join date is invalid" };
    }
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        ctc: data.ctc,
        joinDate,
        status: data.status,
      },
    });
    revalidatePath("/hr/employees");
    return { success: true, data: employee };
  } catch (error) {
    console.error("Failed to update employee:", error);
    return { success: false, error: "Failed to update employee" };
  }
}

export async function deleteEmployee(id: string) {
  if (!(await hasPermission("hr.employees.action.delete"))) return { success: false, error: "Not allowed" };
  try {
    const organizationId = await requireOrganizationId();
    await requireOwnedRecord(prisma.employee, id, organizationId);
    await prisma.employee.delete({
      where: { id },
    });
    revalidatePath("/hr/employees");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return { success: false, error: "Failed to delete employee" };
  }
}

export async function getHRSettings() {
  if (!(await hasAnyPermission(["hr.access", "hr.salary.process"]))) {
    return { success: false, error: "Not allowed" };
  }

  try {
    const organizationId = await requireOrganizationId();
    const settings = await prisma.companySettings.findFirst({
      where: { organizationId },
      select: {
        salaryDivisionDays: true,
        defaultSalaryExpenseAccount: true,
        defaultSalaryPayableAccount: true,
      },
    });

    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: "Failed to fetch settings" };
  }
}

export async function getProcessedSalaries(month: number, year: number) {
  if (!(await hasPermission("hr.salary.process"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const salaries = await prisma.salarySlip.findMany({
      where: {
        organizationId,
        month,
        year,
        status: "POSTED",
        journalEntryId: { not: null },
      },
    });

    return { success: true, data: salaries };
  } catch (error) {
    return { success: false, error: "Failed to fetch processed salaries" };
  }
}

export async function cancelSalarySlip(id: string) {
  if (!(await hasPermission("hr.salary.process"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const slip = await prisma.salarySlip.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        employeeId: true,
        journalEntryId: true,
      },
    });

    if (!slip) {
      return { success: false, error: "Salary slip not found" };
    }

    if (slip.status !== "POSTED") {
      return { success: false, error: "Only POSTED salary slips can be cancelled" };
    }

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

    const payableAfterCancel = otherPostedPayable._sum.finalPayableAmount || 0;
    const paid = totalPaid._sum.amount || 0;

    if (paid > payableAfterCancel) {
      return {
        success: false,
        error: "Cannot cancel: salary has already been paid against this payable",
      };
    }

    const result = await prisma.$transaction(async (tx: any) => {
      if (slip.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: slip.journalEntryId } });
      }

      return tx.salarySlip.update({
        where: { id: slip.id },
        data: {
          status: "CANCELLED",
          journalEntryId: null,
        },
      });
    });

    revalidatePath("/hr/salary-process");
    revalidatePath(`/hr/salary-process/${id}`);

    return { success: true, data: result };
  } catch (error) {
    console.error("Cancel Salary Slip Error:", error);
    return { success: false, error: "Failed to cancel salary slip" };
  }
}

export async function deleteCancelledSalarySlip(id: string) {
  if (!(await hasPermission("hr.salary.process"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const slip = await prisma.salarySlip.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, journalEntryId: true },
    });

    if (!slip) {
      return { success: false, error: "Salary slip not found" };
    }

    if (slip.status !== "CANCELLED") {
      return { success: false, error: "Only CANCELLED salary slips can be deleted" };
    }

    await prisma.$transaction(async (tx: any) => {
      if (slip.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: slip.journalEntryId } });
      }
      await tx.salarySlip.delete({ where: { id: slip.id } });
    });

    revalidatePath("/hr/salary-process");

    return { success: true };
  } catch (error) {
    console.error("Delete Salary Slip Error:", error);
    return { success: false, error: "Failed to delete salary slip" };
  }
}

export async function updateCancelledSalarySlip(
  id: string,
  data: {
    ctcAmount: number;
    absentDays: number;
    payableAmount: number;
    bonus: number;
    deduction: number;
    finalPayableAmount: number;
  }
) {
  if (!(await hasPermission("hr.salary.process"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const slip = await prisma.salarySlip.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });

    if (!slip) {
      return { success: false, error: "Salary slip not found" };
    }

    if (slip.status !== "CANCELLED") {
      return { success: false, error: "Only CANCELLED salary slips can be edited" };
    }

    const updated = await prisma.salarySlip.update({
      where: { id: slip.id },
      data: {
        ctcAmount: data.ctcAmount,
        absentDays: data.absentDays,
        payableAmount: data.payableAmount,
        bonus: data.bonus,
        deduction: data.deduction,
        finalPayableAmount: data.finalPayableAmount,
      },
    });

    revalidatePath("/hr/salary-process");
    revalidatePath(`/hr/salary-process/${id}`);
    revalidatePath(`/hr/salary-process/${id}/edit`);

    return { success: true, data: updated };
  } catch (error) {
    console.error("Update Salary Slip Error:", error);
    return { success: false, error: "Failed to update salary slip" };
  }
}

async function resolveHRAccounts(txOrPrisma: any, organizationId: string, settings: any) {
  const expenseRef = settings?.defaultSalaryExpenseAccount;
  const payableRef = settings?.defaultSalaryPayableAccount;

  const expenseAccount = await txOrPrisma.account.findFirst({
    where: {
      organizationId,
      OR: [
        ...(expenseRef ? [{ id: expenseRef }, { name: expenseRef }] : []),
        { code: "5310" },
        { name: "Salary Expense" },
      ],
    },
  });

  const payableAccount = await txOrPrisma.account.findFirst({
    where: {
      organizationId,
      OR: [
        ...(payableRef ? [{ id: payableRef }, { name: payableRef }] : []),
        { code: "2200" },
        { name: "Salary Payable" },
      ],
    },
  });

  if (!expenseAccount || !payableAccount) {
    return {
      error: "Salary Expense (5310) or Salary Payable (2200) account could not be found in Chart of Accounts. Please configure HR accounts in Settings first.",
    };
  }

  if (settings && (settings.defaultSalaryExpenseAccount !== expenseAccount.id || settings.defaultSalaryPayableAccount !== payableAccount.id)) {
    try {
      await txOrPrisma.companySettings.update({
        where: { id: settings.id },
        data: {
          defaultSalaryExpenseAccount: expenseAccount.id,
          defaultSalaryPayableAccount: payableAccount.id,
        },
      });
    } catch (e) {
      console.warn("Could not auto-update companySettings HR accounts:", e);
    }
  }

  return { expenseAccountId: expenseAccount.id, payableAccountId: payableAccount.id };
}

export async function processSalaryBatch(month: number, year: number, slips: any[]) {
  if (!(await hasPermission("hr.salary.process"))) return { success: false, error: "Not allowed" };

  try {
    const lastDayOfMonth = new Date(year, month, 0);
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const lastDayMidnight = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    if (todayMidnight < lastDayMidnight) {
      const formattedDate = lastDayOfMonth.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      return {
        success: false,
        error: `Salary for this month can only be processed on or after the last date of the month (${formattedDate}).`,
      };
    }

    const organizationId = await requireOrganizationId();
    const settings = await prisma.companySettings.findFirst({ where: { organizationId } });
    const { expenseAccountId, payableAccountId, error: accError } = await resolveHRAccounts(prisma, organizationId, settings);
    if (accError || !expenseAccountId || !payableAccountId) {
      return { success: false, error: accError || "Please configure default HR accounts in Settings first." };
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const createdSlips = [];

      for (const slip of slips) {
        const existingSlips = await tx.salarySlip.findMany({
          where: {
            organizationId,
            employeeId: slip.employeeId,
            month,
            year,
          },
          include: {
            journalEntry: true,
          },
        });

        for (const existingSlip of existingSlips) {
          if (existingSlip.journalEntry) {
            await tx.journalEntry.delete({
              where: { id: existingSlip.journalEntry.id },
            });
          }
          await tx.salarySlip.delete({ where: { id: existingSlip.id } });
        }

        const newSlip = await tx.salarySlip.create({
          data: {
            organizationId,
            employeeId: slip.employeeId,
            month,
            year,
            ctcAmount: slip.ctcAmount,
            absentDays: slip.absentDays,
            bonus: slip.bonus,
            deduction: slip.deduction,
            payableAmount: slip.payableAmount,
            finalPayableAmount: slip.finalPayableAmount,
            status: "POSTED",
          },
        });

        createdSlips.push(newSlip);

        if (slip.finalPayableAmount > 0) {
          await tx.journalEntry.create({
            data: {
              entryNumber: `SAL-${year}-${month}-${slip.employeeId.substring(0, 4)}`,
              organizationId,
              date: new Date(year, month, 0),
              description: `Salary for ${month}/${year}`,
              rows: {
                create: [
                  {
                    organizationId,
                    accountId: expenseAccountId,
                    debit: slip.finalPayableAmount,
                    credit: 0,
                  },
                  {
                    organizationId,
                    accountId: payableAccountId,
                    debit: 0,
                    credit: slip.finalPayableAmount,
                  },
                ],
              },
              salarySlip: {
                connect: { id: newSlip.id },
              },
            },
          });
        }
      }

      return createdSlips;
    });

    revalidatePath("/hr/salary-process");

    return { success: true, data: result };
  } catch (error) {
    console.error("Salary Processing Error:", error);
    return { success: false, error: "Failed to process salary batch: " + (error as Error).message };
  }
}

export async function getEmployeePayableBalance(employeeId: string) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const slips = await prisma.salarySlip.aggregate({
      where: {
        organizationId,
        employeeId,
        status: "POSTED",
        journalEntryId: { not: null },
      },
      _sum: {
        finalPayableAmount: true,
      },
    });

    const payments = await prisma.salaryPayment.aggregate({
      where: {
        organizationId,
        employeeId,
        status: "POSTED",
      },
      _sum: {
        amount: true,
      },
    });

    const totalPayable = slips._sum.finalPayableAmount || 0;
    const totalPaid = payments._sum.amount || 0;

    return { success: true, balance: totalPayable - totalPaid };
  } catch (error) {
    return { success: false, error: "Failed to fetch balance" };
  }
}

export async function createSalaryPayment(data: {
  employeeId: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  fromAccountId: string;
  reference?: string;
}) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const settings = await prisma.companySettings.findFirst({ where: { organizationId } });
    const { payableAccountId, error: accError } = await resolveHRAccounts(prisma, organizationId, settings);
    if (accError || !payableAccountId) {
      return { success: false, error: accError || "Please configure default Salary Payable account in Settings." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.salaryPayment.create({
        data: {
          organizationId,
          paymentNumber: `PAY-${randomUUID()}`,
          employeeId: data.employeeId,
          date: data.date,
          amount: data.amount,
          status: "POSTED",
          paymentMethod: data.paymentMethod,
          fromAccountId: data.fromAccountId,
          reference: data.reference,
        },
      });

      await tx.journalEntry.create({
        data: {
          entryNumber: `SPAY-${randomUUID()}`,
          organizationId,
          date: data.date,
          description: `Salary Payment to Employee`,
          reference: data.reference,
          rows: {
            create: [
              {
                organizationId,
                accountId: payableAccountId,
                debit: data.amount,
                credit: 0,
              },
              {
                organizationId,
                accountId: data.fromAccountId,
                debit: 0,
                credit: data.amount,
              },
            ],
          },
          salaryPayment: {
            connect: { id: payment.id },
          },
        },
      });

      return payment;
    });

    revalidatePath("/hr/salary-payment");

    return { success: true, data: result };
  } catch (error) {
    console.error("Payment Error:", error);
    return { success: false, error: "Failed to record payment" };
  }
}

export async function getEmployeesWithPayableBalances() {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const [employees, slipSums, paymentSums] = await prisma.$transaction([
      prisma.employee.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.salarySlip.groupBy({
        by: ["employeeId"],
        where: { organizationId, status: "POSTED", journalEntryId: { not: null } },
        orderBy: { employeeId: "asc" },
        _sum: { finalPayableAmount: true },
      }),
      prisma.salaryPayment.groupBy({
        by: ["employeeId"],
        where: { organizationId, status: "POSTED" },
        orderBy: { employeeId: "asc" },
        _sum: { amount: true },
      }),
    ]);

    const payableByEmployeeId = new Map<string, number>();
    for (const row of slipSums) {
      payableByEmployeeId.set(row.employeeId, row._sum?.finalPayableAmount ?? 0);
    }

    const paidByEmployeeId = new Map<string, number>();
    for (const row of paymentSums) {
      paidByEmployeeId.set(row.employeeId, row._sum?.amount ?? 0);
    }

      const data = employees.map((employee: any) => {
      const totalPayable = payableByEmployeeId.get(employee.id) || 0;
      const totalPaid = paidByEmployeeId.get(employee.id) || 0;

      return {
        id: employee.id,
        name: employee.name,
        payableBalance: totalPayable - totalPaid,
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch employee balances:", error);
    return { success: false, error: "Failed to fetch employee balances" };
  }
}

export async function createBulkSalaryPayments(data: {
  date: Date;
  items: {
    employeeId: string;
    amount: number;
    paymentMethod: string;
    fromAccountId: string;
    reference?: string;
  }[];
}) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const settings = await prisma.companySettings.findFirst({ where: { organizationId } });
    const { payableAccountId, error: accError } = await resolveHRAccounts(prisma, organizationId, settings);
    if (accError || !payableAccountId) {
      return { success: false, error: accError || "Please configure default Salary Payable account in Settings." };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: "No employees selected for payment." };
    }

    const employeeIds = Array.from(new Set(data.items.map((item) => item.employeeId)));
    const [slipSums, paymentSums] = await prisma.$transaction([
      prisma.salarySlip.groupBy({
        by: ["employeeId"],
        where: { organizationId, employeeId: { in: employeeIds }, status: "POSTED", journalEntryId: { not: null } },
        orderBy: { employeeId: "asc" },
        _sum: { finalPayableAmount: true },
      }),
      prisma.salaryPayment.groupBy({
        by: ["employeeId"],
        where: { organizationId, employeeId: { in: employeeIds }, status: "POSTED" },
        orderBy: { employeeId: "asc" },
        _sum: { amount: true },
      }),
    ]);

    const payableByEmployeeId = new Map<string, number>();
    for (const row of slipSums) {
      payableByEmployeeId.set(row.employeeId, row._sum?.finalPayableAmount ?? 0);
    }

    const paidByEmployeeId = new Map<string, number>();
    for (const row of paymentSums) {
      paidByEmployeeId.set(row.employeeId, row._sum?.amount ?? 0);
    }

    for (const item of data.items) {
      if (!item.employeeId) {
        return { success: false, error: "Employee is required." };
      }

      if (!item.fromAccountId) {
        return { success: false, error: "From account is required for all selected rows." };
      }

      if (!item.paymentMethod) {
        return { success: false, error: "Payment method is required for all selected rows." };
      }

      if (!item.amount || item.amount <= 0) {
        return { success: false, error: "Amount must be greater than 0 for all selected rows." };
      }

      const totalPayable = payableByEmployeeId.get(item.employeeId) || 0;
      const totalPaid = paidByEmployeeId.get(item.employeeId) || 0;
      const balance = totalPayable - totalPaid;

      if (item.amount > balance) {
        return { success: false, error: "One or more rows have amount greater than payable balance." };
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const createdPayments = [];

      for (const item of data.items) {
        const payment = await tx.salaryPayment.create({
          data: {
            organizationId,
            paymentNumber: `PAY-${randomUUID()}`,
            employeeId: item.employeeId,
            date: data.date,
            amount: item.amount,
            status: "POSTED",
            paymentMethod: item.paymentMethod,
            fromAccountId: item.fromAccountId,
            reference: item.reference,
          },
        });

        await tx.journalEntry.create({
          data: {
            entryNumber: `SPAY-${randomUUID()}`,
            organizationId,
            date: data.date,
            description: `Salary Payment to Employee`,
            reference: item.reference,
            rows: {
              create: [
                {
                  organizationId,
                  accountId: payableAccountId,
                  debit: item.amount,
                  credit: 0,
                },
                {
                  organizationId,
                  accountId: item.fromAccountId,
                  debit: 0,
                  credit: item.amount,
                },
              ],
            },
            salaryPayment: {
              connect: { id: payment.id },
            },
          },
        });

        createdPayments.push(payment);
      }

      return createdPayments;
    });

    revalidatePath("/hr/salary-payment");
    revalidatePath("/hr/salary-payment/bulk");

    return { success: true, data: result };
  } catch (error) {
    console.error("Bulk Payment Error:", error);
    return { success: false, error: "Failed to record bulk payments" };
  }
}

export async function cancelSalaryPayment(id: string) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const payment = await prisma.salaryPayment.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        journalEntryId: true,
      },
    });

    if (!payment) {
      return { success: false, error: "Salary payment not found" };
    }

    if (payment.status !== "POSTED") {
      return { success: false, error: "Only POSTED salary payments can be cancelled" };
    }

    const result = await prisma.$transaction(async (tx: any) => {
      if (payment.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: payment.journalEntryId } });
      }

      return tx.salaryPayment.update({
        where: { id: payment.id },
        data: {
          status: "CANCELLED",
          journalEntryId: null,
        },
      });
    });

    revalidatePath("/hr/salary-payment");
    revalidatePath(`/hr/salary-payment/${id}`);

    return { success: true, data: result };
  } catch (error) {
    console.error("Cancel Salary Payment Error:", error);
    return { success: false, error: "Failed to cancel salary payment" };
  }
}

export async function deleteCancelledSalaryPayment(id: string) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const payment = await prisma.salaryPayment.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, journalEntryId: true },
    });

    if (!payment) {
      return { success: false, error: "Salary payment not found" };
    }

    if (payment.status !== "CANCELLED") {
      return { success: false, error: "Only CANCELLED salary payments can be deleted" };
    }

    await prisma.$transaction(async (tx: any) => {
      if (payment.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: payment.journalEntryId } });
      }

      await tx.salaryPayment.delete({ where: { id: payment.id } });
    });

    revalidatePath("/hr/salary-payment");

    return { success: true };
  } catch (error) {
    console.error("Delete Salary Payment Error:", error);
    return { success: false, error: "Failed to delete salary payment" };
  }
}

export async function updateCancelledSalaryPayment(
  id: string,
  data: {
    date: Date;
    amount: number;
    paymentMethod: string;
    fromAccountId: string;
    reference?: string;
  }
) {
  if (!(await hasPermission("hr.salary.payments"))) return { success: false, error: "Not allowed" };

  try {
    const organizationId = await requireOrganizationId();
    const payment = await prisma.salaryPayment.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });

    if (!payment) {
      return { success: false, error: "Salary payment not found" };
    }

    if (payment.status !== "CANCELLED") {
      return { success: false, error: "Only CANCELLED salary payments can be edited" };
    }

    const updated = await prisma.salaryPayment.update({
      where: { id: payment.id },
      data: {
        date: data.date,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        fromAccountId: data.fromAccountId,
        reference: data.reference,
      },
    });

    revalidatePath("/hr/salary-payment");
    revalidatePath(`/hr/salary-payment/${id}/edit`);

    return { success: true, data: updated };
  } catch (error) {
    console.error("Update Salary Payment Error:", error);
    return { success: false, error: "Failed to update salary payment" };
  }
}
