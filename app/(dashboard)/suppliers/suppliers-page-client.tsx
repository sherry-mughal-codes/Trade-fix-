"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import { deleteSupplier } from "@/app/(dashboard)/customers/actions";

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  ntn: string | null;
  strn: string | null;
  email: string | null;
  currency: string | null;
  creditLimit: number;
  creditStatus: string;
  type?: string;
  companyType?: { title?: string | null } | null;
  _openPayable?: number;
  [key: string]: any;
};

export const SUPPLIER_FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "Name", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "ntn", label: "NTN", type: "text" },
  { name: "strn", label: "STRN", type: "text" },
  { name: "contactPerson", label: "Contact Person", type: "text" },
  { name: "currency", label: "Currency", type: "text" },
];

type Props = {
  suppliers: SupplierRow[];
  totalCount: number;
  page: number;
  limit: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function SuppliersPageClient({ suppliers, totalCount, page, limit, canCreate, canEdit, canDelete }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const handleDelete = (supplier: SupplierRow) => async () => {
    const res = await deleteSupplier(supplier.id);
    startTransition(() => {
      router.refresh();
    });
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Master supplier records for purchases, bills, and payments.</p>
        </div>
        {canCreate ? (
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="inline-flex items-center justify-center px-4 py-2 border border-input text-sm font-medium rounded-md hover:bg-accent transition-colors"
            >
              Customers
            </Link>
            <Link
              href="/suppliers/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Link>
          </div>
        ) : null}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
        <SearchInput placeholder="Search suppliers..." />
        <DynamicFilter fields={SUPPLIER_FILTER_FIELDS} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Supplier</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Contact Person</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Phone</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Tax IDs</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Currency</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Open Payable</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const openPayable = Number(supplier._openPayable || 0);
                  return (
                    <tr key={supplier.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{supplier.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {supplier.companyType?.title || "No type"}
                          {supplier.type === "BOTH" ? " • Supplier + Customer" : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{supplier.contactPerson || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{supplier.phone || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div>NTN: {supplier.ntn || "-"}</div>
                        <div>STRN: {supplier.strn || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{supplier.currency || "PKR"}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{openPayable.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <RowActions
                          id={supplier.id}
                          editUrl={canEdit ? `/suppliers/${supplier.id}/edit` : undefined}
                          onDelete={canDelete ? handleDelete(supplier) : undefined}
                          viewData={supplier}
                          type="supplier"
                          itemLabel="Supplier"
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
