
"use client";

import { useState, useEffect } from "react";
import { getAccounts, getGeneralLedgerReport, getParties, getEmployees, getCompanySettings } from "./actions";
import Select from "react-select";
import { Loader2, Search, Calendar, X } from "lucide-react";
import toast from "react-hot-toast";
import { usePermissions } from "@/lib/use-permissions";

// Helper for currency formatting
const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

// Helper for date formatting
const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function GeneralLedgerPage() {
  const { loading: permissionsLoading, has } = usePermissions();
  const canViewGeneralLedger = has("reports.generalLedger");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  
  // Initialize filters with last 30 days and all accounts
  const [filters, setFilters] = useState({
    accountId: "all",
    startDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
    partyType: "all", // 'CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'all'
    partyId: "all"
  });

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canViewGeneralLedger) return;

    const initData = async () => {
        const [accRes, partyRes, empRes, setRes] = await Promise.all([
            getAccounts(),
            getParties('all'),
            getEmployees(),
            getCompanySettings()
        ]);

        if (accRes.success) setAccounts(accRes.data || []);
        if (partyRes.success) setParties(partyRes.data || []);
        if (empRes.success) setEmployees(empRes.data || []);
        if (setRes.success) setSettings(setRes.data);
    };

    initData();
    // Fetch report data on mount with default filters
    void handleRunReport(filters);
  }, [permissionsLoading, canViewGeneralLedger]);

  // Effect to auto-select account based on Party Type
  // Only trigger when partyType or partyId changes manually? 
  // Ideally, when user selects a specific party, we auto-select the account.
  useEffect(() => {
      if (filters.partyId && filters.partyId !== 'all' && settings) {
          let targetAccount = null;
          
          if (filters.partyType === 'CUSTOMER') {
              targetAccount = settings.defaultReceivableAccount;
          } else if (filters.partyType === 'SUPPLIER') {
              targetAccount = settings.defaultPayableAccount;
          } else if (filters.partyType === 'EMPLOYEE') {
              targetAccount = settings.defaultSalaryPayableAccount;
          }

          if (targetAccount) {
              setFilters(prev => ({ ...prev, accountId: targetAccount }));
          }
      }
  }, [filters.partyId, filters.partyType, settings]);

  if (permissionsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canViewGeneralLedger) {
    return <div className="p-6 text-center text-muted-foreground">You do not have access to this report.</div>;
  }

  const handleRunReport = async (currentFilters = filters) => {
    setLoading(true);
    try {
      const result = await getGeneralLedgerReport({
        accountId: currentFilters.accountId || undefined,
        startDate: currentFilters.startDate ? new Date(currentFilters.startDate) : undefined,
        endDate: currentFilters.endDate ? new Date(currentFilters.endDate) : undefined,
        partyType: currentFilters.partyType !== 'all' ? currentFilters.partyType : undefined,
        partyId: currentFilters.partyId !== 'all' ? currentFilters.partyId : undefined,
      });

      if (result.success) {
        setReportData(result.data);
      } else {
        toast.error(result.error || "Failed to generate report");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const defaultFilters = {
        accountId: "all",
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        partyType: "all",
        partyId: "all"
      };
      
      setFilters(defaultFilters);
      handleRunReport(defaultFilters);
  };

  // Prepare options
  const accountOptions = [
    { value: "all", label: "All Accounts" },
    ...accounts
      .filter((acc) => !acc.isGroup)
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
      .map((acc) => ({
        value: acc.id,
        label: `${acc.code ? acc.code + " - " : ""}${acc.name} (${acc.type})`,
      })),
  ];

  const partyTypeOptions = [
      { value: "all", label: "All Types" },
      { value: "CUSTOMER", label: "Customer" },
      { value: "SUPPLIER", label: "Supplier" },
      { value: "EMPLOYEE", label: "Employee" },
  ];

  // Dynamic Party Options
  const getPartyOptions = () => {
      const options = [{ value: "all", label: "All Parties" }];
      
      if (filters.partyType === 'EMPLOYEE') {
          employees.forEach(emp => {
              options.push({ value: emp.id, label: emp.name });
          });
      } else if (filters.partyType === 'CUSTOMER') {
          parties.filter(p => ['customer', 'both'].includes(p.type)).forEach(p => {
              options.push({ value: p.id, label: p.name });
          });
      } else if (filters.partyType === 'SUPPLIER') {
          parties.filter(p => ['supplier', 'both'].includes(p.type)).forEach(p => {
              options.push({ value: p.id, label: p.name });
          });
      } else {
          // All
          parties.forEach(p => options.push({ value: p.id, label: p.name }));
          employees.forEach(e => options.push({ value: e.id, label: `${e.name} (Emp)` }));
      }
      return options;
  };

  // Calculate running balance
  let runningBalance = reportData?.openingBalance || 0;
  const baseCurrency = reportData?.baseCurrency || "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-muted-foreground">
            View detailed transaction history.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col gap-4">
        
        {/* Row 1: Party Filters */}
        <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/4">
                <label className="text-sm font-medium mb-1 block">Party Type</label>
                <Select
                    options={partyTypeOptions}
                    value={partyTypeOptions.find(opt => opt.value === filters.partyType)}
                    onChange={(option) => setFilters({ ...filters, partyType: option?.value || "all", partyId: "all" })}
                    placeholder="Select Type..."
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                />
            </div>
            <div className="w-full md:w-1/4">
                <label className="text-sm font-medium mb-1 block">Party / Employee</label>
                <Select
                    options={getPartyOptions()}
                    value={getPartyOptions().find(opt => opt.value === filters.partyId)}
                    onChange={(option) => setFilters({ ...filters, partyId: option?.value || "all" })}
                    placeholder="Select Party..."
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                    isDisabled={filters.partyType === 'all'}
                />
            </div>
            <div className="w-full md:w-1/2">
                <label className="text-sm font-medium mb-1 block">Account</label>
                <Select
                    options={accountOptions}
                    value={accountOptions.find((opt) => opt.value === filters.accountId)}
                    onChange={(option) => setFilters({ ...filters, accountId: option?.value || "all" })}
                    placeholder="Select Account..."
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                    isClearable
                />
            </div>
        </div>

        {/* Row 2: Date & Action */}
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/4">
            <label className="text-sm font-medium mb-1 block">From Date</label>
            <div className="relative">
                <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            </div>

            <div className="w-full md:w-1/4">
            <label className="text-sm font-medium mb-1 block">To Date</label>
            <div className="relative">
                <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            </div>

            <div className="w-full md:w-1/2 flex gap-2">
                <button
                    type="button"
                    onClick={handleResetFilters}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    title="Reset Filters"
                >
                    <X className="h-4 w-4" />
                </button>
                <button
                type="button"
                onClick={() => handleRunReport()}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-minia-primary text-primary-foreground hover:bg-minia-primary/90 h-10 px-4 py-2"
                >
                {loading ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                    </>
                ) : (
                    <>
                    <Search className="mr-2 h-4 w-4" />
                    Run Report
                    </>
                )}
                </button>
            </div>
        </div>
      </div>

      {/* Results */}
      {reportData && (
        <div className="rounded-md border bg-card">
          <div className="p-4 border-b bg-muted/50 flex justify-between items-center">
            <h3 className="font-semibold">
              Transactions
              {filters.startDate && filters.endDate && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  ({formatDate(filters.startDate)} - {formatDate(filters.endDate)})
                </span>
              )}
            </h3>
            <div className="text-sm">
                {filters.accountId && filters.accountId !== "all" && (
                    <span className="font-medium">
                        Opening Balance: {formatCurrency(reportData.openingBalance, baseCurrency)}
                    </span>
                )}
            </div>
          </div>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Entry #</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Description</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Party</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Account</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Debit</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Credit</th>
                  {filters.accountId && filters.accountId !== "all" && (
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Balance</th>
                  )}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {/* Opening Balance Row if applicable */}
                {filters.accountId && filters.accountId !== "all" && filters.startDate && (
                    <tr className="border-b transition-colors hover:bg-muted/50 bg-muted/20">
                        <td className="p-4 align-middle font-medium" colSpan={7}>Opening Balance</td>
                        <td className="p-4 align-middle text-right font-medium">{formatCurrency(reportData.openingBalance, baseCurrency)}</td>
                    </tr>
                )}

                {reportData.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  reportData.transactions.map((row: any) => {
                    // Update running balance
                    
                    if (filters.accountId && filters.accountId !== "all") {
                         if (['ASSET', 'EXPENSE'].includes(reportData.accountType)) {
                            runningBalance += (row.debit - row.credit);
                         } else {
                            runningBalance += (row.credit - row.debit);
                         }
                    }

                    return (
                      <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle">{formatDate(row.journalEntry.date)}</td>
                        <td className="p-4 align-middle font-mono text-xs">{row.journalEntry.entryNumber}</td>
                        <td className="p-4 align-middle">
                          <div className="flex flex-col">
                            <span>{row.description || row.journalEntry.description}</span>
                            {row.journalEntry.reference && (
                                <span className="text-xs text-muted-foreground">Ref: {row.journalEntry.reference}</span>
                            )}
                            {row.currency && row.currency !== baseCurrency && (
                                <span className="text-xs text-blue-500">
                                    Orig: {row.currency} (Entry in {baseCurrency})
                                </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground text-xs">
                            {row.partyName || "-"}
                        </td>
                        <td className="p-4 align-middle">{row.account.name}</td>
                        <td className="p-4 align-middle text-right">{row.debit > 0 ? formatCurrency(row.debit, baseCurrency) : "-"}</td>
                        <td className="p-4 align-middle text-right">{row.credit > 0 ? formatCurrency(row.credit, baseCurrency) : "-"}</td>
                        {filters.accountId && filters.accountId !== "all" && (
                            <td className="p-4 align-middle text-right font-medium">
                                {formatCurrency(runningBalance, baseCurrency)}
                            </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
