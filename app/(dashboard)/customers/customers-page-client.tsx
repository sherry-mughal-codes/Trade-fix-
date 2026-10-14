"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import { deleteCustomer } from "@/app/(dashboard)/customers/actions";

export type CustomerRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  ntn: string | null;
  strn: string | null;
  currency: string | null;
  creditLimit: number;
  creditStatus: string;
  type?: string;
  companyType?: { title?: string | null } | null;
  [key: string]: any;
};

export const CUSTOMER_FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "Name", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "ntn", label: "NTN", type: "text" },
  { name: "strn", label: "STRN", type: "text" },
  { name: "contactPerson", label: "Contact Person", type: "text" },
  { name: "companyType.title", label: "Company Type", type: "text" },
  { name: "currency", label: "Currency", type: "text" },
];

type Props = {
  customers: CustomerRow[];
  totalCount: number;
  page: number;
  limit: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function CustomersPageClient({ customers, totalCount, page, limit, canCreate, canEdit, canDelete }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const handleDelete = (customer: CustomerRow) => async () => {
    const res = await deleteCustomer(customer.id);
    startTransition(() => {
      router.refresh();
    });
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Master customer records with credit control for invoices, payments, and collections.</p>
        </div>
        {canCreate ? (
          <div className="flex items-center gap-3">
            <Link
              href="/suppliers"
              className="inline-flex items-center justify-center px-4 py-2 border border-input text-sm font-medium rounded-md hover:bg-accent transition-colors"
            >
              Suppliers
            </Link>
            <Link
              href="/customers/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Link>
          </div>
        ) : null}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
        <SearchInput placeholder="Search customers..." />
        <DynamicFilter fields={CUSTOMER_FILTER_FIELDS} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Contact Person</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Phone</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Tax IDs</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Currency</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Credit</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const usedCredit = Number(customer._usedCredit || 0);
                  const creditLimit = Number(customer.creditLimit || 0);
                  const remaining = creditLimit > 0 ? Math.max(creditLimit - usedCredit, 0) : null;
                  const creditTone =
                    customer.creditStatus === "ON_HOLD"
                      ? "text-red-600"
                      : remaining !== null && remaining <= 0
                        ? "text-red-600"
                        : remaining !== null && remaining <= creditLimit * 0.2
                          ? "text-amber-600"
                          : "text-muted-foreground";

                  return (
                    <tr key={customer.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.companyType?.title || "No type"}
                          {customer.type === "BOTH" ? " • Customer + Supplier" : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{customer.contactPerson || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{customer.phone || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div>NTN: {customer.ntn || "-"}</div>
                        <div>STRN: {customer.strn || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{customer.currency || "-"}</td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${creditTone}`}>
                          {creditLimit > 0 ? `${customer.currency} ${creditLimit.toLocaleString()}` : "Unlimited"}
                        </div>
                        <div className="text-xs text-muted-foreground">Used: {customer.currency} {usedCredit.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {remaining === null ? "Remaining: Unlimited" : `Remaining: ${customer.currency} ${remaining.toLocaleString()}`}
                        </div>
                        <div className={`text-xs ${customer.creditStatus === "ON_HOLD" ? "text-red-600" : "text-muted-foreground"}`}>
                          {customer.creditStatus === "ON_HOLD" ? "On Hold" : "Active"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RowActions
                          id={customer.id}
                          editUrl={canEdit ? `/customers/${customer.id}/edit` : undefined}
                          onDelete={canDelete ? handleDelete(customer) : undefined}
                          viewData={{
                            ...customer,
                            currentExposure: usedCredit,
                            remainingCredit: remaining,
                          }}
                          type="customer"
                          itemLabel="Customer"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount} pageSize={limit} />
      </div>
    </div>
  );
}
