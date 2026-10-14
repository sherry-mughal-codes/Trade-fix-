"use client";

import { useState, useEffect } from "react";
import { getReceivableSummary } from "./actions";
import { Loader2, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

export default function ReceivableSummaryClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    summary: any[];
    totalReceivable: number;
    totalDueThisMonth: number;
    baseCurrency: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getReceivableSummary();
      if (result.success) {
        setData(result.data || null);
      } else {
        toast.error(result.error || "Failed to load report");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const baseCurrency = data?.baseCurrency || "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receivable Summary</h1>
          <p className="text-muted-foreground">Summary of outstanding invoices by customer.</p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <div className="p-4 border-b bg-muted/50 flex justify-between items-center">
            <h3 className="font-semibold">Outstanding Balances</h3>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase">Due This Month</p>
                <p className="text-lg font-bold text-orange-600">
                  {data ? formatCurrency(data.totalDueThisMonth || 0, baseCurrency) : "$0.00"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase">Total Due</p>
                <p className="text-lg font-bold text-green-600">
                  {data ? formatCurrency(data.totalReceivable, baseCurrency) : "$0.00"}
                </p>
              </div>
            </div>
          </div>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer Name</th>
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Invoices #</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Total Invoiced</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Paid Amount</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Due This Month</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Balance Due</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {data?.summary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No outstanding receivables found.
                    </td>
                  </tr>
                ) : (
                  data?.summary.map((row) => (
                    <tr key={row.uniqueKey} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle font-medium">
                        <div>
                          {row.partyName}
                          {row.currency !== baseCurrency && (
                            <div className="text-xs text-muted-foreground">Currency: {row.currency}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">{row.invoiceCount}</td>
                      <td className="p-4 align-middle text-right">
                        <div>{formatCurrency(row.totalInvoiced, baseCurrency)}</div>
                        {row.currency !== baseCurrency && row.foreignTotalInvoiced > 0 && (
                          <div className="text-xs text-muted-foreground">
                            ({formatCurrency(row.foreignTotalInvoiced, row.currency)})
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <div>{formatCurrency(row.totalPaid, baseCurrency)}</div>
                        {row.currency !== baseCurrency && row.foreignTotalPaid > 0 && (
                          <div className="text-xs text-muted-foreground">
                            ({formatCurrency(row.foreignTotalPaid, row.currency)})
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right text-orange-600 font-medium">
                        <div>{formatCurrency(row.dueThisMonth || 0, baseCurrency)}</div>
                        {row.currency !== baseCurrency && row.foreignDueThisMonth > 0 && (
                          <div className="text-xs text-orange-400 font-normal">
                            ({formatCurrency(row.foreignDueThisMonth, row.currency)})
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right font-bold">
                        <div>{formatCurrency(row.balanceDue, baseCurrency)}</div>
                        {row.currency !== baseCurrency && row.foreignBalanceDue > 0 && (
                          <div className="text-xs text-muted-foreground font-normal">
                            ({formatCurrency(row.foreignBalanceDue, row.currency)})
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
