"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createPOSProfile, updatePOSProfile } from "../actions";

type UserOption = { id: string; name: string | null; email: string | null };
type PartyOption = { id: string; name: string };
type PriceListOption = { id: string; name: string };
type CounterOption = { id: string; name: string };
type AccountOption = { id: string; name: string; type: string; subType: string | null; isGroup: boolean };

type POSProfileFormData = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  defaultUserId?: string | null;
  walkinCustomerId: string;
  defaultPriceListId?: string | null;
  defaultPaymentMethod: string;
  posCounterId: string;
  defaultCashAccountId: string;
  defaultBankAccountId: string;
  allowCreditCheckout: boolean;
  allowPriceOverride: boolean;
  allowDiscount: boolean;
  maxDiscountPct: number;
  requireCustomerForCredit: boolean;
  customerQuickCreate: boolean;
  hideOutOfStockItems: boolean;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  printerName?: string | null;
};

interface POSProfileFormProps {
  initialData?: POSProfileFormData | null;
  users: UserOption[];
  customers: PartyOption[];
  priceLists: PriceListOption[];
  counters: CounterOption[];
  accounts: AccountOption[];
}

const PAYMENT_METHOD_OPTIONS = [
  { label: "Cash", value: "CASH" },
  { label: "Card", value: "CARD" },
  { label: "Bank", value: "BANK" },
  { label: "Wallet", value: "WALLET" },
];

export default function POSProfileForm({
  initialData,
  users,
  customers,
  priceLists,
  counters,
  accounts,
}: POSProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(initialData?.id);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(
    initialData?.defaultPaymentMethod || "CASH"
  );

  const isExcluded = (a: any) => {
    const subType = (a.subType || "").toLowerCase();
    const name = (a.name || "").toLowerCase();
    return (
      subType === "receivable" ||
      subType === "payable" ||
      subType === "inventory" ||
      name.includes("receivable") ||
      name.includes("payable") ||
      name.includes("inventory")
    );
  };

  const cashAccountOptions = accounts.filter(
    (a) =>
      !a.isGroup &&
      !isExcluded(a) &&
      (a.subType?.toLowerCase() === "cash" ||
        a.name.toLowerCase().includes("cash") ||
        a.type === "ASSET")
  );

  const matchedBankOptions = accounts.filter(
    (a) =>
      !a.isGroup &&
      !isExcluded(a) &&
      (a.subType?.toLowerCase() === "bank" ||
        a.name.toLowerCase().includes("bank") ||
        a.name.toLowerCase().includes("hbl") ||
        a.name.toLowerCase().includes("meezan") ||
        a.name.toLowerCase().includes("mcb") ||
        a.name.toLowerCase().includes("ubl") ||
        a.name.toLowerCase().includes("alfalah") ||
        a.name.toLowerCase().includes("allied"))
  );
  const bankAccountOptions =
    matchedBankOptions.length > 0
      ? matchedBankOptions
      : accounts.filter((a) => !a.isGroup && a.type === "ASSET" && !isExcluded(a));

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    formData.set("defaultPaymentMethod", defaultPaymentMethod);

    try {
      const result = isEditing && initialData
        ? await updatePOSProfile(initialData.id, formData)
        : await createPOSProfile(formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`POS Profile ${isEditing ? "updated" : "created"} successfully`);
      router.push(result?.redirectUrl || "/pos/profiles");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/pos/profiles" className="rounded-full p-2 transition-colors hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? "Edit POS Profile" : "New POS Profile"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update profile defaults, permissions, and receipt configuration."
                : "Create a new cashier profile with defaults and behavior settings."}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="space-y-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Basic Details</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Profile Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={initialData?.name || ""}
                placeholder="e.g. Front Desk Cashier"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-foreground">
                Short Code
              </label>
              <input
                id="code"
                name="code"
                defaultValue={initialData?.code || ""}
                placeholder="e.g. FD-01"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                Status
              </label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={initialData?.isActive === false ? "false" : "true"}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Links & Defaults</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="posCounterId" className="text-sm font-medium text-foreground">
                POS Counter <span className="text-red-500">*</span>
              </label>
              <select
                id="posCounterId"
                name="posCounterId"
                required
                defaultValue={initialData?.posCounterId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select counter...</option>
                {counters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="defaultUserId" className="text-sm font-medium text-foreground">
                Default Cashier
              </label>
              <select
                id="defaultUserId"
                name="defaultUserId"
                defaultValue={initialData?.defaultUserId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">— Auto-assign —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="walkinCustomerId" className="text-sm font-medium text-foreground">
                Walk-in Customer <span className="text-red-500">*</span>
              </label>
              <select
                id="walkinCustomerId"
                name="walkinCustomerId"
                required
                defaultValue={initialData?.walkinCustomerId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="defaultPriceListId" className="text-sm font-medium text-foreground">
                Default Price List
              </label>
              <select
                id="defaultPriceListId"
                name="defaultPriceListId"
                defaultValue={initialData?.defaultPriceListId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">— Use standard —</option>
                {priceLists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="defaultCashAccountId" className="text-sm font-medium text-foreground">
                Default Cash Account <span className="text-red-500">*</span>
              </label>
              <select
                id="defaultCashAccountId"
                name="defaultCashAccountId"
                required
                defaultValue={initialData?.defaultCashAccountId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select cash account...</option>
                {cashAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="defaultBankAccountId" className="text-sm font-medium text-foreground">
                Default Bank Account <span className="text-red-500">*</span>
              </label>
              <select
                id="defaultBankAccountId"
                name="defaultBankAccountId"
                required
                defaultValue={initialData?.defaultBankAccountId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select bank account...</option>
                {bankAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium text-foreground">
              Default Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    defaultPaymentMethod === opt.value
                      ? "border-minia-primary bg-minia-primary/10 text-minia-primary"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultPaymentMethodRadio"
                    value={opt.value}
                    checked={defaultPaymentMethod === opt.value}
                    onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Behavior & Permissions</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="allowCreditCheckout"
                defaultChecked={initialData?.allowCreditCheckout || false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Allow Credit Checkout</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Let cashiers sell on credit (no immediate payment).
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="allowPriceOverride"
                defaultChecked={initialData?.allowPriceOverride || false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Allow Price Override</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Permit changing line unit prices at checkout.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="allowDiscount"
                defaultChecked={initialData?.allowDiscount !== false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Allow Discounts</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Enable line-level and overall discounts.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="requireCustomerForCredit"
                defaultChecked={initialData?.requireCustomerForCredit !== false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Customer for Credit</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Require a named customer when choosing credit checkout.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="customerQuickCreate"
                defaultChecked={initialData?.customerQuickCreate !== false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Customer Quick Create</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Allow inline creation of new customers from POS.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
              <input
                type="checkbox"
                name="hideOutOfStockItems"
                defaultChecked={initialData?.hideOutOfStockItems !== false}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Hide Out of Stock</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Filter zero-stock items from the item picker.
                </div>
              </div>
            </label>

            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <label htmlFor="maxDiscountPct" className="text-sm font-medium text-foreground">
                Max Discount %
              </label>
              <input
                id="maxDiscountPct"
                name="maxDiscountPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={initialData?.maxDiscountPct ?? 5}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
              <div className="text-xs text-muted-foreground">
                Maximum line discount percentage cashiers can apply.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Receipt & Printing</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="receiptHeader" className="text-sm font-medium text-foreground">
                Receipt Header
              </label>
              <textarea
                id="receiptHeader"
                name="receiptHeader"
                rows={2}
                defaultValue={initialData?.receiptHeader || ""}
                placeholder="Appears at the top of printed receipts (e.g. store slogan)."
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="receiptFooter" className="text-sm font-medium text-foreground">
                Receipt Footer
              </label>
              <textarea
                id="receiptFooter"
                name="receiptFooter"
                rows={2}
                defaultValue={initialData?.receiptFooter || ""}
                placeholder="Appears at the bottom of printed receipts (e.g. return policy)."
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label htmlFor="printerName" className="text-sm font-medium text-foreground">
                Printer Name
              </label>
              <input
                id="printerName"
                name="printerName"
                defaultValue={initialData?.printerName || ""}
                placeholder="e.g. USB Thermal Printer or shared queue name."
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
              <div className="text-xs text-muted-foreground">
                Optional: target printer for silent / quick printing from this profile.
              </div>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
