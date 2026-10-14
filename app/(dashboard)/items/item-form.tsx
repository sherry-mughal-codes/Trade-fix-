"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { createItem, updateItem } from "./actions";

type ItemUnitRow = {
  id: string;
  unitName: string;
  conversionFactor: number;
};

type ItemFormData = {
  id: string;
  itemCode?: string | null;
  name: string;
  category?: string | null;
  description?: string | null;
  defaultUnit: string;
  itemType: string;
  isActive: boolean;
  trackBatches: boolean;
  hasExpiry: boolean;
  unitConversions?: Array<{
    id: string;
    unitName: string;
    conversionFactor: number;
  }>;
};

interface ItemFormProps {
  initialData?: ItemFormData | null;
  units: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

function createUnitRow(unit?: Partial<ItemUnitRow>): ItemUnitRow {
  return {
    id: unit?.id || Math.random().toString(36).slice(2, 9),
    unitName: unit?.unitName || "",
    conversionFactor: unit?.conversionFactor || 0,
  };
}

export default function ItemForm({ initialData, units, categories }: ItemFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState(initialData?.itemType || "INVENTORY");
  const [unitRows, setUnitRows] = useState<ItemUnitRow[]>(
    initialData?.unitConversions?.length
      ? initialData.unitConversions.map((unit) => createUnitRow(unit))
      : []
  );

  const isEditing = Boolean(initialData?.id);
  const isInventoryItem = itemType === "INVENTORY";
  const unitOptions = useMemo(() => {
    const map = new Map(units.map((unit) => [unit.name, unit]));
    if (initialData?.defaultUnit && !map.has(initialData.defaultUnit)) {
      map.set(initialData.defaultUnit, { id: `current-${initialData.defaultUnit}`, name: initialData.defaultUnit });
    }
    return Array.from(map.values());
  }, [initialData?.defaultUnit, units]);

  const categoryOptions = useMemo(() => {
    const map = new Map(categories.map((category) => [category.name, category]));
    if (initialData?.category && !map.has(initialData.category)) {
      map.set(initialData.category, { id: `current-${initialData.category}`, name: initialData.category });
    }
    return Array.from(map.values());
  }, [categories, initialData?.category]);

  const unitsPayload = useMemo(
    () =>
      unitRows.map((unit) => ({
        unitName: unit.unitName.trim(),
        conversionFactor: Number(unit.conversionFactor || 0),
      })),
    [unitRows]
  );

  const updateUnitRow = (id: string, field: keyof ItemUnitRow, value: string | number) => {
    setUnitRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    formData.set("unitsData", JSON.stringify(unitsPayload));

    try {
      const result = isEditing && initialData
        ? await updateItem(initialData.id, formData)
        : await createItem(formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Item ${isEditing ? "updated" : "created"} successfully`);
      router.push("/items");
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
          <Link href="/items" className="rounded-full p-2 transition-colors hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{isEditing ? "Edit Item" : "New Item"}</h1>
            <p className="text-sm text-muted-foreground">
              Define the item master, base unit, and alternate unit conversions for inventory planning.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : "Save Item"}
        </button>
      </div>

      <div className="space-y-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Item Profile</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="itemCode" className="text-sm font-medium text-foreground">Item Code</label>
              <input
                id="itemCode"
                name="itemCode"
                defaultValue={initialData?.itemCode || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                placeholder="Optional code"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Item Name</label>
              <input
                id="name"
                name="name"
                required
                defaultValue={initialData?.name || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-foreground">Category</label>
              <select
                id="category"
                name="category"
                defaultValue={initialData?.category || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select category</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Manage categories from Master Data.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="defaultUnit" className="text-sm font-medium text-foreground">Default Unit</label>
              <select
                id="defaultUnit"
                name="defaultUnit"
                required
                defaultValue={initialData?.defaultUnit || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="" disabled>Select unit</option>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.name}>{unit.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Manage units from Master Data.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="itemType" className="text-sm font-medium text-foreground">Item Type</label>
              <select
                id="itemType"
                name="itemType"
                value={itemType}
                onChange={(event) => setItemType(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="INVENTORY">Inventory</option>
                <option value="NON_INVENTORY">Non-Inventory</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="isActive" className="text-sm font-medium text-foreground">Status</label>
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

            <div className="space-y-2 md:col-span-3">
              <label htmlFor="description" className="text-sm font-medium text-foreground">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={initialData?.description || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Inventory Behavior</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="trackBatches" className="text-sm font-medium text-foreground">Track Batches</label>
              <select
                id="trackBatches"
                name="trackBatches"
                defaultValue={isInventoryItem && initialData?.trackBatches === true ? "true" : "false"}
                disabled={!isInventoryItem}
                className="w-full rounded-md border border-input bg-background px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              {!isInventoryItem ? (
                <input type="hidden" name="trackBatches" value="false" />
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="hasExpiry" className="text-sm font-medium text-foreground">Handle Expiry</label>
              <select
                id="hasExpiry"
                name="hasExpiry"
                defaultValue={isInventoryItem && initialData?.hasExpiry === true ? "true" : "false"}
                disabled={!isInventoryItem}
                className="w-full rounded-md border border-input bg-background px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              {!isInventoryItem ? (
                <input type="hidden" name="hasExpiry" value="false" />
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Alternate Units</h2>
              <p className="text-xs text-muted-foreground">Define how extra units convert into the default unit.</p>
            </div>
            <button
              type="button"
              onClick={() => setUnitRows((current) => [...current, createUnitRow()])}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Add Unit
            </button>
          </div>

          {unitRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No alternate units added yet.
            </div>
          ) : (
            <div className="space-y-3">
              {unitRows.map((unit) => (
                <div key={unit.id} className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 md:grid-cols-[1.4fr_1fr_auto]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit Name</label>
                    <select
                      value={unit.unitName}
                      onChange={(event) => updateUnitRow(unit.id, "unitName", event.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="">Select unit</option>
                      {unitOptions.map((option) => (
                        <option key={option.id} value={option.name}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversion Factor</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={unit.conversionFactor}
                      onChange={(event) => updateUnitRow(unit.id, "conversionFactor", parseFloat(event.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      placeholder="How many base units"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setUnitRows((current) => current.filter((row) => row.id !== unit.id))}
                      className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </form>
  );
}
