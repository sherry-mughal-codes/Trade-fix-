import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Pagination from "@/components/ui/pagination";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { deleteItem } from "./actions";
import { hasItemMasterAccess, requireItemMasterAccess } from "./access";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: FilterField[] = [
  { name: "itemCode", label: "Item Code", type: "text" },
  { name: "name", label: "Name", type: "text" },
  { name: "category", label: "Category", type: "text" },
  { name: "defaultUnit", label: "Default Unit", type: "text" },
  {
    name: "itemType",
    label: "Type",
    type: "select",
    options: [
      { label: "Inventory", value: "INVENTORY" },
      { label: "Non-Inventory", value: "NON_INVENTORY" },
    ],
  },
];

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: { query?: string; filters?: string; page?: string; limit?: string };
}) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  const canManage = await hasItemMasterAccess();
  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    OR: [
      { name: { contains: query } },
      { itemCode: { contains: query } },
      { category: { contains: query } },
      { defaultUnit: { contains: query } },
    ],
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
      console.error("Failed to parse item filters", error);
    }
  }

  const [items, totalCount] = await Promise.all([
    prisma.item.findMany({
      where: whereClause,
      include: {
        unitConversions: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.item.count({ where: whereClause }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Item Master</h1>
          <p className="text-sm text-muted-foreground">
            Maintain inventory and non-inventory items with a base unit and alternate unit conversions.
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-3">
            <Link
              href="/masters"
              className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Master Data
            </Link>
            <Link
              href="/items/new"
              className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Link>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search items..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Item</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Category</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Units</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Stock</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Tracking</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.itemCode || "No code"} • Base Unit: {item.defaultUnit}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{item.category || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${item.itemType === "INVENTORY" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {item.itemType === "INVENTORY" ? "Inventory" : "Non-Inventory"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div>{item.defaultUnit}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.unitConversions.length
                          ? item.unitConversions.map((unit) => `${unit.unitName} (${unit.conversionFactor})`).join(", ")
                          : "No alternate units"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.itemType === "INVENTORY" ? (
                        <>
                          <div>{Number(item.stockOnHand || 0).toLocaleString()} {item.defaultUnit}</div>
                          <div className="text-xs text-muted-foreground">
                            Avg Cost: {Number(item.movingAverageCost || 0).toLocaleString()}
                          </div>
                        </>
                      ) : (
                        "Not stock-tracked"
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.itemType === "INVENTORY"
                        ? `${item.trackBatches ? "Batch" : "No Batch"} • ${item.hasExpiry ? "Expiry" : "No Expiry"}`
                        : "Not stock-tracked"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-minia-success/10 text-minia-success" : "bg-muted text-muted-foreground"}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowActions
                        id={item.id}
                        editUrl={canManage ? `/items/${item.id}/edit` : undefined}
                        onDelete={canManage ? deleteItem.bind(null, item.id) : undefined}
                        type="item"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / limit)}
          totalCount={totalCount}
          pageSize={limit}
        />
      </div>
    </div>
  );
}
