import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RowActions from "@/components/ui/row-actions";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../items/access";
import { deletePriceList } from "./actions";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "List Name", type: "text" },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: [
      { label: "Selling", value: "SELLING" },
      { label: "Buying", value: "BUYING" },
    ],
  },
];

export default async function PriceListsPage({
  searchParams,
}: {
  searchParams?: { query?: string; filters?: string; page?: string; limit?: string };
}) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);

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
      console.error("Failed to parse price list filters", error);
    }
  }

  const [priceLists, totalCount] = await Promise.all([
    prisma.priceList.findMany({
      where: whereClause,
      orderBy: [{ isSystemDefault: "desc" }, { type: "asc" }, { name: "asc" }],
      take: limit,
      skip,
    }),
    prisma.priceList.count({ where: whereClause }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Price Lists</h1>
          <p className="text-sm text-muted-foreground">
            Maintain standard and customer/supplier-specific selling and buying price lists.
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
            href="/masters/price-lists/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Price List
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search price lists..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">List</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {priceLists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No price lists found.</td>
                </tr>
              ) : (
                priceLists.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
                          <Tags className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{row.name}</div>
                          {row.isSystemDefault ? (
                            <div className="mt-1 text-xs text-muted-foreground">Standard</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {row.type === "BUYING" ? "Buying" : "Selling"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${row.isActive ? "bg-minia-success/10 text-minia-success" : "bg-muted text-muted-foreground"}`}>
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowActions
                        id={row.id}
                        editUrl={`/masters/price-lists/${row.id}/edit`}
                        onDelete={row.isSystemDefault ? undefined : deletePriceList.bind(null, row.id)}
                        type="priceList"
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

