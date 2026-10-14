"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CreditCard, Calendar } from "lucide-react";
import {
  getEmployees,
  getAccounts,
  getEmployeePayableBalance,
  createSalaryPayment,
} from "../actions";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  name: string;
};

export default function SalaryPaymentForm() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cashGroupAccountId, setCashGroupAccountId] = useState<string | null>(null);
  const [bankGroupAccountId, setBankGroupAccountId] = useState<string | null>(null);

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("Bank Transfer");
  const [fromAccount, setFromAccount] = useState("");
  const [reference, setReference] = useState("");

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

  const filteredAccounts = useMemo(() => {
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
  }, [accounts, method, cashGroupAccountId, bankGroupAccountId]);

  useEffect(() => {
    const isCurrentAccountValid = filteredAccounts.some((account) => account.id === fromAccount);
    if (!isCurrentAccountValid && filteredAccounts.length > 0) {
      setFromAccount(filteredAccounts[0].id);
    } else if (filteredAccounts.length === 0) {
      setFromAccount("");
    }
  }, [filteredAccounts, fromAccount]);

  const router = useRouter();

  // Fetch accounts with full data (parent, type, etc) to enable filtering
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [empResult, accResult] = await Promise.all([
        getEmployees(),
        getAccounts(),
      ]);

      if (empResult.success && empResult.data) {
        setEmployees(empResult.data as Employee[]);
      }
      if (accResult.success && accResult.data) {
        setAccounts(accResult.data);
        setCashGroupAccountId((accResult as any).cashGroupAccountId || null);
        setBankGroupAccountId((accResult as any).bankGroupAccountId || null);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedEmployee) {
        setBalance(null);
        return;
      }
      setFetchingBalance(true);
      const result = await getEmployeePayableBalance(selectedEmployee);
      if (result.success) {
        setBalance(result.balance || 0);
        // Auto-fill amount if balance > 0?
        if ((result.balance || 0) > 0) {
            setAmount(result.balance || 0);
        } else {
            setAmount(0);
        }
      }
      setFetchingBalance(false);
    };
    fetchBalance();
  }, [selectedEmployee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !amount || !fromAccount) {
      toast.error("Please fill all required fields");
      return;
    }

    setProcessing(true);
    const result = await createSalaryPayment({
      employeeId: selectedEmployee,
      date: new Date(date),
      amount,
      paymentMethod: method,
      fromAccountId: fromAccount,
      reference,
    });

    if (result.success) {
      toast.success("Payment recorded successfully!");
      setAmount(0);
      setSelectedEmployee("");
      setReference("");
      setBalance(null);
      router.push("/hr/salary-payment");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to record payment");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
              required
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployee && (
            <div className="p-4 bg-muted/50 rounded-md flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">
                Current Payable Balance:
              </span>
              {fetchingBalance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-lg font-bold">
                  {balance?.toLocaleString()}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Date</label>
              <div className="relative">
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md [&::-webkit-calendar-picker-indicator]:hidden"
                    required
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Account</label>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                required
              >
                <option value="">Select Account</option>
                {filteredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ` : ""}
                    {acc.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Bank or Cash account
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reference / Note</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
              placeholder="Cheque No / Transaction ID"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={processing || !selectedEmployee}
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Salary
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
