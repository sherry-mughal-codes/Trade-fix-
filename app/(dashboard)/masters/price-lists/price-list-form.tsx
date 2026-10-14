"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createPriceList, updatePriceList } from "./actions";

type ItemOption = {
  id: string;
  name: string;
  category: string | null;
  defaultUnit: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type PriceListItemRow = {
  itemId: string;
  price: number;
};

type PriceListFormData = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isSystemDefault?: boolean;
  items?: Array<{
    itemId: string;
    price: number;
  }>;
};

interface PriceListFormProps {
  initialData?: PriceListFormData | null;
  items: ItemOption[];
  categories: CategoryOption[];
}

function normalizeType(value: string) {
  return value.toUpperCase() === "BUYING" ? "BUYING" : "SELLING";
}

function createRow(row?: Partial<PriceListItemRow>): PriceListItemRow {
  return {
    itemId: row?.itemId || "",
    price: Number(row?.price || 0),
  };
}

export default function PriceListForm({ initialData, items, categories }: PriceListFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(normalizeType(initialData?.type || "SELLING"));
  const [isActive, setIsActive] = useState(initialData?.isActive === false ? "false" : "true");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const [rows, setRows] = useState<PriceListItemRow[]>(
    initialData?.items?.length ? initialData.items.map((row) => createRow(row)) : []
  );

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categoryById.get(selectedCategoryId)?.name || null;
  }, [categoryById, selectedCategoryId]);

  const payload = useMemo(
    () =>
      rows
        .filter((row) => row.itemId)
        .map((row) => ({
          itemId: row.itemId,
          price: Number(row.price || 0),
        })),
    [rows]
  );

  const addMissingItems = (candidateIds: string[]) => {
    const existing = new Set(rows.map((row) => row.itemId));
    const toAdd = candidateIds.filter((id) => id && !existing.has(id));
    if (!toAdd.length) {
      toast.success("No new items to load.");
      return;
    }

    setRows((current) => [
      ...current,
      ...toAdd.map((itemId) => createRow({ itemId, price: 0 })),
    ]);
  };

  const loadAllItems = () => {
    addMissingItems(items.map((item) => item.id));
  };

  const loadCategoryItems = () => {
    if (!selectedCategoryName) {
      toast.error("Select a category first.");
      return;
    }
    addMissingItems(items.filter((item) => item.category === selectedCategoryName).map((item) => item.id));
  };

  const updateRow = (itemId: string, field: keyof PriceListItemRow, value: string | number) => {
    setRows((current) =>
      current.map((row) =>
        row.itemId === itemId ? { ...row, [field]: field === "price" ? Number(value || 0) : value } : row
      )
    );
  };

  const removeRow = (itemId: string) => {
    setRows((current) => current.filter((row) => row.itemId !== itemId));
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    formData.set("type", type);
    formData.set("isActive", isActive);
    formData.set("itemsData", JSON.stringify(payload));

    try {
      const result = isEditing && initialData
        ? await updatePriceList(initialData.id, formData)
        : await createPriceList(formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Price list ${isEditing ? "updated" : "created"} successfully`);
      router.push("/masters/price-lists");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    const withMeta = rows
      .map((row) => ({
        ...row,
        meta: itemById.get(row.itemId) || null,
      }))
      .filter((row) => row.meta);
    withMeta.sort((a, b) => (a.meta?.name || "").localeCompare(b.meta?.name || ""));
    return withMeta;
  }, [itemById, rows]);

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/masters/price-lists" className="rounded-full p-2 transition-colors hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? "Edit Price List" : "New Price List"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Maintain selling and buying rates, including standard defaults and customer/supplier-specific lists.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : "Save Price List"}
        </button>
      </div>

      <div className="space-y-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">List Name</label>
              <input
                id="name"
                name="name"
                required
                disabled={Boolean(initialData?.isSystemDefault)}
                defaultValue={initialData?.name || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Type</label>
              <select
                name="type"
                value={type}
                onChange={(event) => setType(normalizeType(event.target.value))}
                disabled={Boolean(initialData?.isSystemDefault)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="SELLING">Selling</option>
                <option value="BUYING">Buying</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              <select
                name="isActive"
                value={isActive}
                onChange={(event) => setIsActive(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Items</h2>
              <p className="text-sm text-muted-foreground">
                Load items into the list and maintain prices. Any missing item resolves to 0 during invoicing.
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-56"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadCategoryItems}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <Plus className="mr-2 h-4 w-4" />
                Load Category
              </button>

              <button
                type="button"
                onClick={loadAllItems}
                className="inline-flex items-center justify-center rounded-md bg-minia-primary/10 px-4 py-2 text-sm font-medium text-minia-primary hover:bg-minia-primary/15"
              >
                <Plus className="mr-2 h-4 w-4" />
                Load All Items
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Item</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Category</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Unit</th>
                    <th className="px-6 py-4 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                        No items loaded yet. Use Load All Items or Load Category.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => (
                      <tr key={row.itemId} className="transition-colors hover:bg-accent/40">
                        <td className="px-6 py-3">
                          <div className="font-medium text-foreground">{row.meta?.name}</div>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{row.meta?.category || "-"}</td>
                        <td className="px-6 py-3 text-muted-foreground">{row.meta?.defaultUnit}</td>
                        <td className="px-6 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.price}
                            onChange={(event) => updateRow(row.itemId, "price", event.target.value)}
                            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-right"
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(row.itemId)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-red-500"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
