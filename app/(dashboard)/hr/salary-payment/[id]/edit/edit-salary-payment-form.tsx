"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Calendar, Loader2, Save } from "lucide-react";
import { getAccounts, updateCancelledSalaryPayment } from "../../../actions";

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

export default function EditSalaryPaymentForm({
  payment,
}: {
  payment: {
    id: string;
    paymentNumber: string;
    status: string;
    date: string;
    amount: number;
    paymentMethod: string;
    fromAccountId: string;
    reference: string | null;
    employee: { name: string } | null;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashGroupAccountId, setCashGroupAccountId] = useState<string | null>(null);
  const [bankGroupAccountId, setBankGroupAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(payment.date.split("T")[0]);
  const [amount, setAmount] = useState<number>(payment.amount);
  const [method, setMethod] = useState(payment.paymentMethod);
  const [fromAccountId, setFromAccountId] = useState(payment.fromAccountId);
  const [reference, setReference] = useState(payment.reference || "");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getAccounts();

      if (result.success && result.data) {
        setAccounts(result.data as Account[]);
        setCashGroupAccountId((result as any).cashGroupAccountId || null);
        setBankGroupAccountId((result as any).bankGroupAccountId || null);
      } else {
        toast.error(result.error || "Failed to fetch accounts");
      }

      setLoading(false);
    };

    load();
  }, []);

  const filteredAccounts = useMemo(() => {
    return filterAccountsForMethod(accounts, method, cashGroupAccountId, bankGroupAccountId);
  }, [accounts, method, cashGroupAccountId, bankGroupAccountId]);

  useEffect(() => {
    const isCurrentValid = filteredAccounts.some((account) => account.id === fromAccountId);
    if (!isCurrentValid && filteredAccounts.length > 0) {
      setFromAccountId(filteredAccounts[0].id);
    } else if (filteredAccounts.length === 0) {
      setFromAccountId("");
    }
  }, [filteredAccounts, fromAccountId]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!date || !fromAccountId || !amount) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);
    const result = await updateCancelledSalaryPayment(payment.id, {
      date: new Date(date),
      amount,
      paymentMethod: method,
      fromAccountId,
      reference: reference || undefined,
    });

    if (result.success) {
      toast.success("Salary payment updated");
      router.push("/hr/salary-payment");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update salary payment");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Employee</div>
            <div className="font-medium text-foreground">{payment.employee?.name || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Payment #</div>
            <div className="font-medium text-foreground">{payment.paymentNumber}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Date</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                onClick={(event) => (event.target as HTMLInputElement).showPicker()}
                className="w-full rounded-md border border-input bg-background px-3 py-2 [&::-webkit-calendar-picker-indicator]:hidden"
                required
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
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
            <label className="text-sm font-medium">From Account</label>
            <select
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            >
              <option value="">Select Account</option>
              {filteredAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Reference / Note</label>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            placeholder="Cheque No / Transaction ID"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-[140px] items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
