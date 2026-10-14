import Link from "next/link";
import { Layers3, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RowActions from "@/components/ui/row-actions";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../items/access";
import { deleteInventoryBatchMaster } from "../actions";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "Batch", type: "text" },
];

export default async function InventoryBatchesMasterPage({
  searchParams,
}: {
  searchParams?: { query?: string; filters?: string; page?: string; limit?: string };
}) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    name: { contains: query },
  });

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        whereClause = {
          AND: [
            whereClause,
            ...filters.map((filter: any) => ({
              [filter.field]: { [filter.operator === "contains" ? "contains" : "equals"]: filter.value },
            })),
          ],
        };
      }
    } catch (error) {
      console.error("Failed to parse batch filters", error);
    }
  }

  const [batches, totalCount] = await Promise.all([
    prisma.inventoryBatchMaster.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      take: limit,
      skip,
    }),
    prisma.inventoryBatchMaster.count({ where: whereClause }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory Batches</h1>
          <p className="text-sm text-muted-foreground">
            Maintain the selectable batch master list used across stock entry, adjustments, and purchase invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/masters"
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Master Data
          </Link>
          <Link
            href="/masters/batches/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Batch
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search batches..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Batch</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No batches found.</td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
                          <Layers3 className="h-4 w-4" />
                        </div>
                        <div className="font-medium text-foreground">{batch.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${batch.isActive ? "bg-minia-success/10 text-minia-success" : "bg-muted text-muted-foreground"}`}>
                        {batch.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowActions
                        id={batch.id}
                        editUrl={`/masters/batches/${batch.id}/edit`}
                        onDelete={deleteInventoryBatchMaster.bind(null, batch.id)}
                        type="batch"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={page} totalPages={Math.ceil(totalCount / limit)} totalCount={totalCount} pageSize={limit} />
      </div>
    </div>
  );
}
