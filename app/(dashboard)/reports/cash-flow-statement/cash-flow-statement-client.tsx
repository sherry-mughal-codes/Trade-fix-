"use client";

import { useCallback, useEffect, useState } from "react";
import { getCashFlowStatement } from "./actions";
import { Calendar, Loader2, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

type SummaryRow = {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  amount: number;
};

type CashFlowStatementData = {
  month: string;
  monthLabel: string;
  baseCurrency: string;
  bankInflows: SummaryRow[];
  cashInflows: SummaryRow[];
  expenseSummary: SummaryRow[];
  totalBankIn: number;
  totalCashIn: number;
  totalIn: number;
  totalExpenses: number;
  difference: number;
};

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function formatCurrency(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function SummaryTable({
  title,
  rows,
  total,
  baseCurrency,
  emptyMessage,
}: {
  title: string;
  rows: SummaryRow[];
  total: number;
  baseCurrency: string;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold">{title}</h3>
          <div className="text-sm font-semibold">
            Total: {formatCurrency(total, baseCurrency)}
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Account
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-4 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.accountId} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-4 align-middle">
                    <div className="font-medium">{row.accountName}</div>
                    {row.accountCode ? (
                      <div className="text-xs text-muted-foreground">{row.accountCode}</div>
                    ) : null}
                  </td>
                  <td className="p-4 align-middle text-right font-medium">
                    {formatCurrency(row.amount, baseCurrency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CashFlowStatementClient() {
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowStatementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await getCashFlowStatement(selectedMonth);

      if (result.success) {
        setData(result.data || null);
      } else {
        setData(null);
        const message = result.error || "Failed to load cash flow statement";
        setError(message);
        toast.error(message);
      }
    } catch (error) {
      setData(null);
      setError("An error occurred while loading the report.");
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [fetchData, month]);

  const baseCurrency = data?.baseCurrency || "USD";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash Flow Statement</h1>
          <p className="text-muted-foreground">
            Review cash and bank inflows, expense summary, and net difference for a month.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-[200px]">
            <label className="mb-1 block text-sm font-medium">Month</label>
            <div className="relative">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <button
            onClick={() => fetchData(month)}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Run Report"
            )}
          </button>

          <button
            onClick={() => {
              const currentMonth = getCurrentMonthValue();
              setMonth(currentMonth);
              fetchData(currentMonth);
            }}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            title="Current Month"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Bank In</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {formatCurrency(data?.totalBankIn || 0, baseCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Cash In</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {formatCurrency(data?.totalCashIn || 0, baseCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total In</p>
          <p className="mt-2 text-2xl font-bold text-minia-primary">
            {formatCurrency(data?.totalIn || 0, baseCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Expenses</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatCurrency(data?.totalExpenses || 0, baseCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Difference</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              (data?.difference || 0) >= 0 ? "text-minia-success" : "text-minia-danger"
            }`}
          >
            {formatCurrency(data?.difference || 0, baseCurrency)}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/50 px-4 py-3">
          <h2 className="font-semibold">
            Selected Period
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {data?.monthLabel || "Current Month"}
            </span>
          </h2>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <SummaryTable
            title="Bank Inflows"
            rows={data?.bankInflows || []}
            total={data?.totalBankIn || 0}
            baseCurrency={baseCurrency}
            emptyMessage="No bank inflows found for the selected month."
          />
          <SummaryTable
            title="Cash Inflows"
            rows={data?.cashInflows || []}
            total={data?.totalCashIn || 0}
            baseCurrency={baseCurrency}
            emptyMessage="No cash inflows found for the selected month."
          />
        </div>
      </div>

      <SummaryTable
        title="Expense Summary"
        rows={data?.expenseSummary || []}
        total={data?.totalExpenses || 0}
        baseCurrency={baseCurrency}
        emptyMessage="No expense entries matched the selected month."
      />
    </div>
  );
}
