"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import InvoiceTypeFilter from "./invoice-type-filter";
import { deleteInvoice } from "./actions";

export const INVOICE_FILTER_FIELDS: FilterField[] = [
  { name: "invoiceNumber", label: "Invoice #", type: "text" },
  { name: "date", label: "Date", type: "date" },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: [
      { label: "Sale", value: "SALE" },
      { label: "POS", value: "POS" },
      { label: "Purchase", value: "PURCHASE" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Draft", value: "DRAFT" },
      { label: "Pending", value: "PENDING" },
      { label: "Paid", value: "PAID" },
      { label: "Overdue", value: "OVERDUE" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  { name: "grandTotal", label: "Amount", type: "number" },
];

type Party = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  type?: string;
  currency?: string;
};

type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type InvoicePaymentRow = {
  id: string;
  paymentNumber?: string | null;
  amount?: number;
  date?: Date | string;
  notes?: string | null;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  date: Date | string;
  dueDate?: Date | string | null;
  party?: Party | null;
  partyName?: string | null;
  currency: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  items?: InvoiceItemRow[];
  payments?: InvoicePaymentRow[];
  notes?: string | null;
  terms?: string | null;
  [key: string]: any;
};

type AccountRow = {
  id: string;
  name: string;
  type?: string;
  code?: string;
  parent?: { id: string; name: string } | null;
};

type CurrencyRow = {
  id: string;
  code: string;
  symbol?: string | null;
  name?: string | null;
};

type Props = {
  invoices: InvoiceRow[];
  totalCount: number;
  page: number;
  limit: number;
  companySettings?: any;
  accounts?: AccountRow[];
  currencies?: CurrencyRow[];
  canCreate?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function InvoicesPageClient({
  invoices,
  totalCount,
  page,
  limit,
  companySettings,
  accounts = [],
  currencies = [],
  canCreate,
  canView,
  canEdit,
  canDelete,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const handleDelete = (invoice: InvoiceRow) => async () => {
    const res = await deleteInvoice(invoice.id);
    startTransition(() => {
      router.refresh();
    });
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage your sales and purchase invoices across customers and suppliers.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        ) : null}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          <InvoiceTypeFilter />
          <SearchInput placeholder="Search invoices..." />
        </div>
        <DynamicFilter fields={INVOICE_FILTER_FIELDS} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Invoice #</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground">Party</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground text-right whitespace-nowrap">Amount</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground text-right whitespace-nowrap">Paid</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground text-right whitespace-nowrap">Balance</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3.5 py-8 text-center text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-3.5 py-3 font-medium text-minia-primary whitespace-nowrap">
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-3 text-foreground max-w-[200px] truncate" title={invoice.party?.name || invoice.partyName || "Unknown"}>
                      {invoice.party?.name || invoice.partyName || "Unknown"}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          invoice.type === "SALE"
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            : "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                        }`}
                      >
                        {invoice.type}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-medium text-foreground whitespace-nowrap">
                      {invoice.currency} {Number(invoice.grandTotal || 0).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {invoice.currency} {Number(invoice.paidAmount || 0).toLocaleString()}
                    </td>
                    <td
                      className={`px-3.5 py-3 text-right font-medium whitespace-nowrap ${
                        Number(invoice.balanceAmount || 0) <= 0 ? "text-minia-success" : "text-minia-danger"
                      }`}
                    >
                      {invoice.currency} {Number(invoice.balanceAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === "PAID"
                            ? "bg-minia-success/10 text-minia-success"
                            : invoice.status === "DRAFT"
                              ? "bg-accent text-muted-foreground"
                              : "bg-minia-warning/10 text-minia-warning"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <RowActions
                        id={invoice.id}
                        viewUrl={canView ? `/invoices/${invoice.id}` : undefined}
                        editUrl={canEdit ? `/invoices/${invoice.id}/edit` : undefined}
                        onDelete={canDelete ? handleDelete(invoice) : undefined}
                        viewData={JSON.parse(JSON.stringify(invoice))}
                        type="invoice"
                        companySettings={companySettings}
                        accounts={accounts}
                        currencies={currencies}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount} pageSize={limit} />
      </div>
    </div>
  );
}
