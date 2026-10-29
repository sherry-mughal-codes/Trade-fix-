"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { createItem, updateItem, checkBarcodeAvailability } from "./actions";

type ItemUnitRow = {
  id: string;
  unitName: string;
  conversionFactor: number;
  barcode: string;
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
    barcode?: string | null;
  }>;
};

interface ItemFormProps {
  initialData?: ItemFormData | null;
  units: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

function createUnitRow(unit?: Partial<ItemUnitRow> | { id?: string; unitName?: string; conversionFactor?: number; barcode?: string | null }): ItemUnitRow {
  return {
    id: unit?.id || Math.random().toString(36).slice(2, 9),
    unitName: unit?.unitName || "",
    conversionFactor: unit?.conversionFactor || 0,
    barcode: unit?.barcode || "",
  };
}

export default function ItemForm({ initialData, units, categories }: ItemFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState(initialData?.itemType || "INVENTORY");
  const [itemCode, setItemCode] = useState(initialData?.itemCode || "");
  const [itemCodeStatus, setItemCodeStatus] = useState<{ checking?: boolean; message?: string; error?: boolean }>({});
  const [unitRows, setUnitRows] = useState<ItemUnitRow[]>(
    initialData?.unitConversions?.length
      ? initialData.unitConversions.map((unit) => createUnitRow(unit))
      : []
  );
  const [barcodeStatuses, setBarcodeStatuses] = useState<Record<string, { checking?: boolean; message?: string; error?: boolean }>>({});

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
        id: unit.id,
        unitName: unit.unitName.trim(),
        conversionFactor: Number(unit.conversionFactor || 0),
        barcode: unit.barcode.trim(),
      })),
    [unitRows]
  );

  const updateUnitRow = (id: string, field: keyof ItemUnitRow, value: string | number) => {
    setUnitRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  // Debounced check for Item Code
  const itemCodeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const trimmed = itemCode.trim();
    if (!trimmed) {
      setItemCodeStatus({});
      return;
    }

    if (itemCodeDebounceRef.current) {
      clearTimeout(itemCodeDebounceRef.current);
    }

    setItemCodeStatus({ checking: true });
    itemCodeDebounceRef.current = setTimeout(async () => {
      try {
        const result = await checkBarcodeAvailability(trimmed, initialData?.id);
        if (!result.available) {
          setItemCodeStatus({ checking: false, error: true, message: result.message });
        } else {
          setItemCodeStatus({ checking: false, error: false, message: "Code available" });
        }
      } catch {
        setItemCodeStatus({ checking: false });
      }
    }, 350);

    return () => {
      if (itemCodeDebounceRef.current) {
        clearTimeout(itemCodeDebounceRef.current);
      }
    };
  }, [itemCode, initialData?.id]);

  // Debounced check for Alternate Unit Barcodes
  const unitBarcodeDebounceRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const validateUnitBarcode = useCallback(
    (rowId: string, barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) {
        setBarcodeStatuses((prev) => ({
          ...prev,
          [rowId]: { error: true, message: "Barcode is mandatory" },
        }));
        return;
      }

      // Check collision with Item Code
      if (itemCode.trim() && trimmed === itemCode.trim()) {
        setBarcodeStatuses((prev) => ({
          ...prev,
          [rowId]: { error: true, message: "Barcode matches Item Code" },
        }));
        return;
      }

      // Check duplicate within other rows
      const duplicateInRows = unitRows.find(
        (row) => row.id !== rowId && row.barcode.trim() === trimmed
      );
      if (duplicateInRows) {
        setBarcodeStatuses((prev) => ({
          ...prev,
          [rowId]: { error: true, message: "Duplicate barcode in alternate units" },
        }));
        return;
      }

      if (unitBarcodeDebounceRefs.current[rowId]) {
        clearTimeout(unitBarcodeDebounceRefs.current[rowId]);
      }

      setBarcodeStatuses((prev) => ({
        ...prev,
        [rowId]: { checking: true },
      }));

      unitBarcodeDebounceRefs.current[rowId] = setTimeout(async () => {
        try {
          const result = await checkBarcodeAvailability(trimmed, initialData?.id);
          if (!result.available) {
            setBarcodeStatuses((prev) => ({
              ...prev,
              [rowId]: { checking: false, error: true, message: result.message },
            }));
          } else {
            setBarcodeStatuses((prev) => ({
              ...prev,
              [rowId]: { checking: false, error: false, message: "Barcode available" },
            }));
          }
        } catch {
          setBarcodeStatuses((prev) => ({
            ...prev,
            [rowId]: { checking: false },
          }));
        }
      }, 350);
    },
    [initialData?.id, itemCode, unitRows]
  );

  useEffect(() => {
    unitRows.forEach((row) => {
      if (row.barcode) {
        validateUnitBarcode(row.id, row.barcode);
      }
    });
  }, [unitRows.length, itemCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (formData: FormData) => {
    // Check if any unit is missing barcode
    for (const unit of unitRows) {
      if (!unit.unitName.trim()) {
        toast.error("Please select a unit name for all alternate units.");
        return;
      }
      if (!unit.barcode.trim()) {
        toast.error(`Barcode is mandatory for alternate unit "${unit.unitName}".`);
        return;
      }
      if (!(unit.conversionFactor > 0)) {
        toast.error(`Conversion factor for "${unit.unitName}" must be greater than zero.`);
        return;
      }
    }

    setLoading(true);
    formData.set("itemCode", itemCode.trim());
    formData.set("unitsData", JSON.stringify(unitsPayload));

    try {
      const result = isEditing && initialData
        ? await updateItem(initialData.id, formData)
        : await createItem(formData);

      if (result && "error" in result && result.error) {
        toast.error(String(result.error));
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
              <div className="flex items-center justify-between">
                <label htmlFor="itemCode" className="text-sm font-medium text-foreground">
                  Item Code (Default Unit Barcode)
                </label>
                {itemCodeStatus.checking ? (
                  <span className="text-xs text-muted-foreground">Checking...</span>
                ) : null}
              </div>
              <input
                id="itemCode"
                name="itemCode"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 bg-background ${
                  itemCodeStatus.error ? "border-red-500 focus:ring-red-500" : "border-input"
                }`}
                placeholder="Optional code / barcode"
              />
              {itemCodeStatus.message ? (
                <p className={`text-xs ${itemCodeStatus.error ? "text-red-500" : "text-emerald-600"}`}>
                  {itemCodeStatus.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Acts as the barcode for the default unit.</p>
              )}
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
              <p className="text-xs text-muted-foreground">
                Define how extra units convert into the default unit. Each alternate unit must have a unique barcode.
              </p>
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
              {unitRows.map((unit) => {
                const status = barcodeStatuses[unit.id];
                return (
                  <div
                    key={unit.id}
                    className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 md:grid-cols-[1.2fr_1fr_1.4fr_auto] md:items-start"
                  >
                    <div className="space-y-1.5">
                      <div className="flex h-5 items-center">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Unit Name
                        </label>
                      </div>
                      <select
                        value={unit.unitName}
                        onChange={(event) => updateUnitRow(unit.id, "unitName", event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      >
                        <option value="">Select unit</option>
                        {unitOptions.map((option) => (
                          <option key={option.id} value={option.name}>{option.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex h-5 items-center">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Conversion Factor
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={unit.conversionFactor || ""}
                        onChange={(event) =>
                          updateUnitRow(unit.id, "conversionFactor", parseFloat(event.target.value) || 0)
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                        placeholder="How many base units"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex h-5 items-center justify-between">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Barcode <span className="text-red-500">*</span>
                        </label>
                        {status?.checking ? (
                          <span className="text-xs text-muted-foreground">Checking...</span>
                        ) : null}
                      </div>
                      <input
                        type="text"
                        required
                        value={unit.barcode}
                        onChange={(event) => {
                          updateUnitRow(unit.id, "barcode", event.target.value);
                          validateUnitBarcode(unit.id, event.target.value);
                        }}
                        className={`h-10 w-full rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 ${
                          status?.error ? "border-red-500 focus:ring-red-500/40" : "border-input focus:ring-minia-primary/40"
                        }`}
                        placeholder="Mandatory unit barcode"
                      />
                      {status?.message ? (
                        <p className={`text-xs ${status?.error ? "text-red-500" : "text-emerald-600"}`}>
                          {status.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <div className="hidden md:flex h-5 items-center" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => {
                          setUnitRows((current) => current.filter((row) => row.id !== unit.id));
                          setBarcodeStatuses((prev) => {
                            const next = { ...prev };
                            delete next[unit.id];
                            return next;
                          });
                        }}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </form>
  );
}
