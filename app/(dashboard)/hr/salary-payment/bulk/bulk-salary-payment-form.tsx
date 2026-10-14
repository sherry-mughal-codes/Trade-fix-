"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Calendar, CreditCard, Loader2, RefreshCcw } from "lucide-react";
import {
  createBulkSalaryPayments,
  getAccounts,
  getEmployeesWithPayableBalances,
} from "../../actions";

type EmployeeWithBalance = {
  id: string;
  name: string;
  payableBalance: number;
};

type Account = {
  id: string;
  name: string;
  code: string | null;
  type?: string;
  subType?: string | null;
  isGroup: boolean;
  parentId?: string | null;
  parent?: { id: string; code: string | null; name?: string | null } | null;
};

type RowOverrides = {
  paymentMethod: boolean;
  fromAccountId: boolean;
  reference: boolean;
};

type PaymentRow = {
  employeeId: string;
  name: string;
  payableBalance: number;
  include: boolean;
  amount: number;
  paymentMethod: string;
  fromAccountId: string;
  reference: string;
  overrides: RowOverrides;
};

const paymentMethods = ["Bank Transfer", "Cash", "Cheque", "Credit Card"] as const;

function filterAccountsForMethod(
  accounts: Account[],
  method: string,
  cashGroupAccountId: string | null,
  bankGroupAccountId: string | null
) {
  const isExcluded = (account: any) => {
    const subType = (account.subType || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    return (
      subType === "receivable" ||
      subType === "payable" ||
      subType === "inventory" ||
      name.includes("receivable") ||
      name.includes("payable") ||
      name.includes("inventory")
    );
  };

  const matched = accounts.filter((account) => {
    if (account.isGroup || isExcluded(account)) return false;

    const accountName = (account.name || "").toLowerCase();
    const accountSubType = (account.subType || "").toLowerCase();
    const parentId = account.parentId;
    const parentCode = account.parent?.code;
    const parentName = (account.parent?.name || "").toLowerCase();

    if (method === "Cash") {
      return (
        (cashGroupAccountId && parentId === cashGroupAccountId) ||
        parentCode === "1100" ||
        parentName === "cash" ||
        accountSubType === "cash" ||
        accountName.includes("cash")
      );
    }

    if (["Bank Transfer", "Cheque", "Credit Card"].includes(method)) {
      return (
        (bankGroupAccountId && parentId === bankGroupAccountId) ||
        parentCode === "1200" ||
        parentName === "bank" ||
        accountSubType === "bank" ||
        accountName.includes("bank") ||
        accountName.includes("hbl") ||
        accountName.includes("meezan") ||
        accountName.includes("mcb") ||
        accountName.includes("ubl") ||
        accountName.includes("alfalah") ||
        accountName.includes("allied")
      );
    }

    return true;
  });

  if (matched.length > 0) return matched;
  return accounts.filter((a) => !a.isGroup && a.type === "ASSET" && !isExcluded(a));
}

export default function BulkSalaryPaymentForm() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashGroupAccountId, setCashGroupAccountId] = useState<string | null>(null);
  const [bankGroupAccountId, setBankGroupAccountId] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split("T")[0]);
  const [defaultMethod, setDefaultMethod] =
    useState<(typeof paymentMethods)[number]>("Bank Transfer");
  const [defaultFromAccountId, setDefaultFromAccountId] = useState("");
  const [defaultReference, setDefaultReference] = useState("");

  const filteredDefaultAccounts = useMemo(() => {
    return filterAccountsForMethod(accounts, defaultMethod, cashGroupAccountId, bankGroupAccountId);
  }, [accounts, defaultMethod, cashGroupAccountId, bankGroupAccountId]);

  const rebuildRows = useCallback(
    (employees: EmployeeWithBalance[], sourceAccounts: Account[]) => {
      setRows(
        employees.map((employee) => {
          const initialAmount = employee.payableBalance > 0 ? employee.payableBalance : 0;
          const rowAccounts = filterAccountsForMethod(
            sourceAccounts,
            defaultMethod,
            cashGroupAccountId,
            bankGroupAccountId
          );
          const defaultIsValid = rowAccounts.some(
            (account) => account.id === defaultFromAccountId
          );

          return {
            employeeId: employee.id,
            name: employee.name,
            payableBalance: employee.payableBalance,
            include: employee.payableBalance > 0,
            amount: initialAmount,
            paymentMethod: defaultMethod,
            fromAccountId: defaultIsValid ? defaultFromAccountId : rowAccounts[0]?.id || "",
            reference: defaultReference,
            overrides: {
              paymentMethod: false,
              fromAccountId: false,
              reference: false,
            },
          } satisfies PaymentRow;
        })
      );
    },
    [defaultFromAccountId, defaultMethod, defaultReference, cashGroupAccountId, bankGroupAccountId]
  );

  const reloadEmployeesWithBalances = async () => {
    const employeesResult = await getEmployeesWithPayableBalances();

    if (employeesResult.success && employeesResult.data) {
      rebuildRows(employeesResult.data as EmployeeWithBalance[], accounts);
      return true;
    }

    toast.error(employeesResult.error || "Failed to fetch employee balances");
    return false;
  };

  useEffect(() => {
    const isCurrentValid = filteredDefaultAccounts.some(
      (account) => account.id === defaultFromAccountId
    );
    if (!isCurrentValid && filteredDefaultAccounts.length > 0) {
      setDefaultFromAccountId(filteredDefaultAccounts[0].id);
    } else if (filteredDefaultAccounts.length === 0) {
      setDefaultFromAccountId("");
    }
  }, [filteredDefaultAccounts, defaultFromAccountId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [accountsResult, employeesResult] = await Promise.all([
        getAccounts(),
        getEmployeesWithPayableBalances(),
      ]);

      const loadedAccounts = accountsResult.success && accountsResult.data ? (accountsResult.data as Account[]) : [];
      if (accountsResult.success && accountsResult.data) {
        setAccounts(loadedAccounts);
        setCashGroupAccountId((accountsResult as any).cashGroupAccountId || null);
        setBankGroupAccountId((accountsResult as any).bankGroupAccountId || null);
      }

      if (employeesResult.success && employeesResult.data) {
        rebuildRows(employeesResult.data as EmployeeWithBalance[], loadedAccounts);
      }

      setLoading(false);
    };

    loadData();
  }, [rebuildRows]);

  useEffect(() => {
    if (!defaultFromAccountId) return;

    setRows((previousRows) =>
      previousRows.map((row) => {
        const nextRow: PaymentRow = { ...row };

        if (!row.overrides.paymentMethod) {
          nextRow.paymentMethod = defaultMethod;
        }

        const rowAccounts = filterAccountsForMethod(
          accounts,
          nextRow.paymentMethod,
          cashGroupAccountId,
          bankGroupAccountId
        );
        const defaultIsValidForRow = rowAccounts.some(
          (account) => account.id === defaultFromAccountId
        );

        if (!row.overrides.fromAccountId) {
          if (defaultIsValidForRow) {
            nextRow.fromAccountId = defaultFromAccountId;
          } else {
            nextRow.fromAccountId = rowAccounts[0]?.id || "";
          }
        } else {
          const currentIsValid = rowAccounts.some((account) => account.id === row.fromAccountId);
          if (!currentIsValid) {
            nextRow.fromAccountId = rowAccounts[0]?.id || "";
          }
        }

        if (!row.overrides.reference) {
          nextRow.reference = defaultReference;
        }

        return nextRow;
      })
    );
  }, [defaultMethod, defaultFromAccountId, defaultReference, accounts, cashGroupAccountId, bankGroupAccountId]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [rows, search]);

  const selectedSummary = useMemo(() => {
    const selectedRows = rows.filter((row) => row.include);
    const count = selectedRows.length;
    const total = selectedRows.reduce(
      (sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0),
      0
    );
    return { count, total };
  }, [rows]);

  const setIncludeAllWithBalance = (include: boolean) => {
    setRows((previousRows) =>
      previousRows.map((row) => {
        if (row.payableBalance <= 0) {
          return { ...row, include: false };
        }
        return { ...row, include };
      })
    );
  };

  const setSelectedAmountToBalance = () => {
    setRows((previousRows) =>
      previousRows.map((row) => {
        if (!row.include) return row;
        return { ...row, amount: row.payableBalance > 0 ? row.payableBalance : 0 };
      })
    );
  };

  const applyDefaultsToSelected = () => {
    if (!defaultFromAccountId) {
      toast.error("Please select a default From Account");
      return;
    }

    setRows((previousRows) =>
      previousRows.map((row) => {
        if (!row.include) return row;
        const rowAccounts = filterAccountsForMethod(
          accounts,
          defaultMethod,
          cashGroupAccountId,
          bankGroupAccountId
        );
        const defaultIsValidForRow = rowAccounts.some(
          (account) => account.id === defaultFromAccountId
        );

        return {
          ...row,
          paymentMethod: defaultMethod,
          fromAccountId: defaultIsValidForRow ? defaultFromAccountId : rowAccounts[0]?.id || "",
          reference: defaultReference,
          overrides: {
            paymentMethod: false,
            fromAccountId: false,
            reference: false,
          },
        };
      })
    );
  };

  const resetRowToDefaults = (employeeId: string) => {
    setRows((previousRows) =>
      previousRows.map((row) => {
        if (row.employeeId !== employeeId) return row;
        const rowAccounts = filterAccountsForMethod(
          accounts,
          defaultMethod,
          cashGroupAccountId,
          bankGroupAccountId
        );
        const defaultIsValidForRow = rowAccounts.some(
          (account) => account.id === defaultFromAccountId
        );

        return {
          ...row,
          paymentMethod: defaultMethod,
          fromAccountId: defaultIsValidForRow ? defaultFromAccountId : rowAccounts[0]?.id || "",
          reference: defaultReference,
          overrides: {
            paymentMethod: false,
            fromAccountId: false,
            reference: false,
          },
        };
      })
    );
  };

  const validateBeforeSubmit = () => {
    const selectedRows = rows.filter((row) => row.include);
    if (selectedRows.length === 0) {
      toast.error("Please select at least one employee");
      return false;
    }

    for (const row of selectedRows) {
      if (!row.paymentMethod) {
        toast.error(`Payment method missing for ${row.name}`);
        return false;
      }
      if (!row.fromAccountId) {
        toast.error(`From account missing for ${row.name}`);
        return false;
      }
      if (!row.amount || row.amount <= 0) {
        toast.error(`Amount must be greater than 0 for ${row.name}`);
        return false;
      }
      if (row.amount > row.payableBalance) {
        toast.error(`Amount exceeds payable balance for ${row.name}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateBeforeSubmit()) return;

    setProcessing(true);
    const selectedRows = rows.filter((row) => row.include);
    const result = await createBulkSalaryPayments({
      date: new Date(defaultDate),
      items: selectedRows.map((row) => ({
        employeeId: row.employeeId,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        fromAccountId: row.fromAccountId,
        reference: row.reference || undefined,
      })),
    });

    if (result.success) {
      toast.success("Bulk payments recorded successfully!");
      await reloadEmployeesWithBalances();
    } else {
      toast.error(result.error || "Failed to record bulk payments");
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Date</label>
            <div className="relative">
              <input
                type="date"
                value={defaultDate}
                onChange={(event) => setDefaultDate(event.target.value)}
                onClick={(event) => (event.target as HTMLInputElement).showPicker()}
                className="w-full rounded-md border border-input bg-background px-3 py-2 [&::-webkit-calendar-picker-indicator]:hidden"
                required
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default Method</label>
            <select
              value={defaultMethod}
              onChange={(event) =>
                setDefaultMethod(event.target.value as (typeof paymentMethods)[number])
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {paymentMethods.map((paymentMethod) => (
                <option key={paymentMethod} value={paymentMethod}>
                  {paymentMethod}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default From Account</label>
            <select
              value={defaultFromAccountId}
              onChange={(event) => setDefaultFromAccountId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            >
              <option value="">Select Account</option>
              {filteredDefaultAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default Reference</label>
            <input
              type="text"
              value={defaultReference}
              onChange={(event) => setDefaultReference(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Cheque No / Transaction ID"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 md:w-72"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIncludeAllWithBalance(true)}
                className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setIncludeAllWithBalance(false)}
                className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={setSelectedAmountToBalance}
                className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                Amount = Balance
              </button>
              <button
                type="button"
                onClick={applyDefaultsToSelected}
                className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                Apply defaults
              </button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{selectedSummary.count}</span>
            {" · "}
            Total: <span className="font-medium text-foreground">{selectedSummary.total.toLocaleString()}</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-2.5 py-2.5 text-center font-medium">
                  <span className="sr-only">Include</span>
                </th>
                <th className="px-2.5 py-2.5 text-left font-medium">Employee</th>
                <th className="px-2.5 py-2.5 text-right font-medium whitespace-nowrap">Payable</th>
                <th className="w-28 px-2.5 py-2.5 text-right font-medium whitespace-nowrap">Amount</th>
                <th className="w-28 px-2.5 py-2.5 text-left font-medium">Method</th>
                <th className="min-w-[140px] px-2.5 py-2.5 text-left font-medium">From Account</th>
                <th className="min-w-[90px] px-2.5 py-2.5 text-left font-medium">Reference</th>
                <th className="w-12 px-2.5 py-2.5 text-center font-medium">Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row) => {
                const rowAccounts = filterAccountsForMethod(
                  accounts,
                  row.paymentMethod,
                  cashGroupAccountId,
                  bankGroupAccountId
                );
                const isDisabled = row.payableBalance <= 0;

                return (
                  <tr key={row.employeeId} className={isDisabled ? "opacity-60" : ""}>
                    <td className="px-2.5 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.include}
                        disabled={isDisabled}
                        onChange={(event) =>
                          setRows((previousRows) =>
                            previousRows.map((currentRow) =>
                              currentRow.employeeId === row.employeeId
                                ? { ...currentRow, include: event.target.checked }
                                : currentRow
                            )
                          )
                        }
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2.5 py-2 font-medium max-w-[150px] truncate" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-2.5 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {row.payableBalance.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        disabled={isDisabled}
                        onChange={(event) => {
                          const value = parseFloat(event.target.value);
                          setRows((previousRows) =>
                            previousRows.map((currentRow) =>
                              currentRow.employeeId === row.employeeId
                                ? {
                                    ...currentRow,
                                    amount: Number.isFinite(value) ? value : 0,
                                  }
                                : currentRow
                            )
                          );
                        }}
                        className="w-24 sm:w-28 rounded border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        value={row.paymentMethod}
                        disabled={isDisabled}
                        onChange={(event) => {
                          const nextMethod = event.target.value;
                          setRows((previousRows) =>
                            previousRows.map((currentRow) => {
                              if (currentRow.employeeId !== row.employeeId) return currentRow;
                              const nextAccounts = filterAccountsForMethod(
                                accounts,
                                nextMethod,
                                cashGroupAccountId,
                                bankGroupAccountId
                              );
                              const currentIsValid = nextAccounts.some(
                                (account) => account.id === currentRow.fromAccountId
                              );
                              const defaultIsValid = nextAccounts.some(
                                (account) => account.id === defaultFromAccountId
                              );

                              return {
                                ...currentRow,
                                paymentMethod: nextMethod,
                                fromAccountId: currentIsValid
                                  ? currentRow.fromAccountId
                                  : defaultIsValid
                                    ? defaultFromAccountId
                                    : nextAccounts[0]?.id || "",
                                overrides: {
                                  ...currentRow.overrides,
                                  paymentMethod: true,
                                },
                              };
                            })
                          );
                        }}
                        className="w-full min-w-[90px] rounded border bg-background px-2 py-1 text-xs sm:text-sm"
                      >
                        {paymentMethods.map((paymentMethod) => (
                          <option key={paymentMethod} value={paymentMethod}>
                            {paymentMethod}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        value={row.fromAccountId}
                        disabled={isDisabled}
                        onChange={(event) =>
                          setRows((previousRows) =>
                            previousRows.map((currentRow) =>
                              currentRow.employeeId === row.employeeId
                                ? {
                                    ...currentRow,
                                    fromAccountId: event.target.value,
                                    overrides: {
                                      ...currentRow.overrides,
                                      fromAccountId: true,
                                    },
                                  }
                                : currentRow
                            )
                          )
                        }
                        className="w-full min-w-[130px] rounded border bg-background px-2 py-1 text-xs sm:text-sm"
                      >
                        <option value="">Select Account</option>
                        {rowAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code ? `${account.code} - ` : ""}
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={row.reference}
                        disabled={isDisabled}
                        onChange={(event) =>
                          setRows((previousRows) =>
                            previousRows.map((currentRow) =>
                              currentRow.employeeId === row.employeeId
                                ? {
                                    ...currentRow,
                                    reference: event.target.value,
                                    overrides: { ...currentRow.overrides, reference: true },
                                  }
                                : currentRow
                            )
                          )
                        }
                        className="w-full min-w-[80px] rounded border bg-background px-2 py-1 text-xs sm:text-sm"
                        placeholder="Txn / Ref"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => resetRowToDefaults(row.employeeId)}
                        className="inline-flex items-center justify-center rounded-md border bg-background p-1.5 text-sm hover:bg-muted disabled:opacity-50"
                        title="Reset row to defaults"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={processing}
            onClick={handleSubmit}
            className="inline-flex min-w-[160px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Selected
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
