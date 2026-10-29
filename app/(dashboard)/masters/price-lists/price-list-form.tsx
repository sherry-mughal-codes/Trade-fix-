"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createPriceList, updatePriceList } from "./actions";

type ItemOption = {
  id: string;
  name: string;
  category: string | null;
  defaultUnit: string;
  unitConversions?: Array<{
    unitName: string;
    conversionFactor: number;
  }>;
};

type CategoryOption = {
  id: string;
  name: string;
};

type PriceListItemRow = {
  rowKey: string;
  itemId: string;
  unitName: string;
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
    unitName: string;
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

function createRow(row?: Partial<PriceListItemRow>, defaultItem?: ItemOption): PriceListItemRow {
  const itemId = row?.itemId || defaultItem?.id || "";
  const unitName = row?.unitName || defaultItem?.defaultUnit || "";
  return {
    rowKey: row?.rowKey || Math.random().toString(36).slice(2, 9),
    itemId,
    unitName,
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
    initialData?.items?.length
      ? initialData.items.map((row) => createRow(row))
      : []
  );

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categoryById.get(selectedCategoryId)?.name || null;
  }, [categoryById, selectedCategoryId]);

  const getItemUnits = useCallback(
    (itemId: string): string[] => {
      const itm = itemById.get(itemId);
      if (!itm) return [];
      const list = [itm.defaultUnit];
      if (itm.unitConversions) {
        for (const c of itm.unitConversions) {
          if (c.unitName && !list.includes(c.unitName)) {
            list.push(c.unitName);
          }
        }
      }
      return list;
    },
    [itemById]
  );

  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
      if (!r.itemId || !r.unitName) continue;
      const key = `${r.itemId}:${r.unitName.toUpperCase()}`;
      if (seen.has(key)) {
        dupes.add(key);
      }
      seen.add(key);
    }
    return dupes;
  }, [rows]);

  const payload = useMemo(
    () =>
      rows
        .filter((row) => row.itemId && row.unitName)
        .map((row) => ({
          itemId: row.itemId,
          unitName: row.unitName,
          price: Number(row.price || 0),
        })),
    [rows]
  );

  const addMissingCandidates = (candidates: Array<{ itemId: string; unitName: string }>) => {
    const existing = new Set(rows.map((row) => `${row.itemId}:${row.unitName.toUpperCase()}`));
    const toAdd = candidates.filter(
      (c) => c.itemId && c.unitName && !existing.has(`${c.itemId}:${c.unitName.toUpperCase()}`)
    );

    if (!toAdd.length) {
      toast.success("No new items or units to load.");
      return;
    }

    setRows((current) => [
      ...current,
      ...toAdd.map((cand) =>
        createRow({
          itemId: cand.itemId,
          unitName: cand.unitName,
          price: 0,
        })
      ),
    ]);
    toast.success(`Loaded ${toAdd.length} unit price row(s).`);
  };

  const loadAllItems = () => {
    const candidates: Array<{ itemId: string; unitName: string }> = [];
    for (const item of items) {
      candidates.push({ itemId: item.id, unitName: item.defaultUnit });
      if (item.unitConversions) {
        for (const conv of item.unitConversions) {
          candidates.push({ itemId: item.id, unitName: conv.unitName });
        }
      }
    }
    addMissingCandidates(candidates);
  };

  const loadCategoryItems = () => {
    if (!selectedCategoryName) {
      toast.error("Select a category first.");
      return;
    }
    const filteredItems = items.filter((item) => item.category === selectedCategoryName);
    const candidates: Array<{ itemId: string; unitName: string }> = [];
    for (const item of filteredItems) {
      candidates.push({ itemId: item.id, unitName: item.defaultUnit });
      if (item.unitConversions) {
        for (const conv of item.unitConversions) {
          candidates.push({ itemId: item.id, unitName: conv.unitName });
        }
      }
    }
    addMissingCandidates(candidates);
  };

  const addBlankRow = () => {
    const defaultItem = items[0];
    setRows((current) => [
      ...current,
      createRow({}, defaultItem),
    ]);
  };

  const handleItemChange = (rowKey: string, newItemId: string) => {
    const item = itemById.get(newItemId);
    setRows((current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) return row;
        return {
          ...row,
          itemId: newItemId,
          unitName: item?.defaultUnit || "",
        };
      })
    );
  };

  const updateRow = (rowKey: string, field: keyof PriceListItemRow, value: string | number) => {
    setRows((current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) return row;
        return {
          ...row,
          [field]: field === "price" ? Number(value || 0) : value,
        };
      })
    );
  };

  const removeRow = (rowKey: string) => {
    setRows((current) => current.filter((row) => row.rowKey !== rowKey));
  };

  const handleSubmit = async (formData: FormData) => {
    if (duplicateKeys.size > 0) {
      toast.error("Duplicate item and unit combinations exist in the price list. Please fix them before saving.");
      return;
    }

    // Verify all rows have valid items and units
    for (const row of rows) {
      if (!row.itemId) {
        toast.error("Please select an item for all rows.");
        return;
      }
      if (!row.unitName) {
        toast.error("Please select a unit for all rows.");
        return;
      }
      if (!Number.isFinite(row.price) || row.price < 0) {
        toast.error("Price must be a non-negative number.");
        return;
      }
    }

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
              Maintain selling and buying rates by item and unit, including standard defaults and customer/supplier-specific lists.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || duplicateKeys.size > 0}
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
              <h2 className="text-sm font-semibold text-foreground">Items & Unit Prices</h2>
              <p className="text-sm text-muted-foreground">
                Maintain rates for each item-unit combination. Alternate units can have distinct prices from the default unit.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm md:w-52"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadCategoryItems}
                className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Load Category
              </button>

              <button
                type="button"
                onClick={loadAllItems}
                className="inline-flex items-center justify-center rounded-md bg-minia-primary/10 px-3 py-2 text-sm font-medium text-minia-primary hover:bg-minia-primary/15"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Load All Items
              </button>

              <button
                type="button"
                onClick={addBlankRow}
                className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Row
              </button>
            </div>
          </div>

          {duplicateKeys.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>One or more item-unit combinations are duplicated below. Each unit for an item can only appear once per price list.</span>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
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
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                        No item prices loaded yet. Use Load All Items, Load Category, or Add Row.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const item = itemById.get(row.itemId);
                      const unitOptions = getItemUnits(row.itemId);
                      const isDupe = duplicateKeys.has(`${row.itemId}:${row.unitName.toUpperCase()}`);

                      return (
                        <tr
                          key={row.rowKey}
                          className={`transition-colors hover:bg-accent/40 ${isDupe ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                        >
                          <td className="px-6 py-3">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleItemChange(row.rowKey, e.target.value)}
                              className="w-full min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Select item</option>
                              {items.map((i) => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                            {isDupe ? (
                              <p className="mt-1 text-xs text-red-500">Duplicate item & unit</p>
                            ) : null}
                          </td>

                          <td className="px-6 py-3 text-muted-foreground">
                            {item?.category || "-"}
                          </td>

                          <td className="px-6 py-3">
                            <select
                              value={row.unitName}
                              onChange={(e) => updateRow(row.rowKey, "unitName", e.target.value)}
                              disabled={!row.itemId}
                              className="w-full min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-muted"
                            >
                              {unitOptions.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit} {unit === item?.defaultUnit ? "(Default)" : "(Alternate)"}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-6 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.price}
                              onChange={(event) => updateRow(row.rowKey, "price", event.target.value)}
                              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-right"
                            />
                          </td>

                          <td className="px-6 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(row.rowKey)}
                              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-red-500"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
