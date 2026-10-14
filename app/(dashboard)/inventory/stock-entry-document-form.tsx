"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import Select from "react-select";
import { toast } from "react-hot-toast";
import { createStockEntry } from "./actions";
import InventoryRowDetailsModal from "./inventory-row-details-modal";

type InventoryItemOption = {
  id: string;
  name: string;
  defaultUnit: string;
  trackBatches: boolean;
  hasExpiry: boolean;
};

type MasterOption = {
  id: string;
  name: string;
};

type EntryRow = {
  id: string;
  itemId: string;
  batchNumber: string;
  expiryDate: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
};

function createEmptyRow(warehouseName: string): EntryRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    itemId: "",
    batchNumber: "",
    expiryDate: "",
    warehouseName,
    quantity: 1,
    unitCost: 0,
  };
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StockEntryDocumentForm({
  items,
  batches,
  warehouses,
  defaultDate,
}: {
  items: InventoryItemOption[];
  batches: MasterOption[];
  warehouses: MasterOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entryType, setEntryType] = useState("OPENING");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [defaultWarehouseName, setDefaultWarehouseName] = useState("");
  const [rows, setRows] = useState<EntryRow[]>([createEmptyRow("")]);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const menuPortalTarget = typeof window !== "undefined" ? document.body : undefined;

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.defaultUnit})`,
      })),
    [items],
  );
  const batchOptions = useMemo(
    () => batches.map((batch) => ({ value: batch.name, label: batch.name })),
    [batches],
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.name, label: warehouse.name })),
    [warehouses],
  );

  const totalQty = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.unitCost || 0), 0);
  const detailRow = rows.find((row) => row.id === detailRowId) || null;
  const detailItem = detailRow ? items.find((item) => item.id === detailRow.itemId) : null;

  const updateRow = (id: string, field: keyof EntryRow, value: string | number) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          [field]: value,
        };
      }),
    );
  };

  const applyDefaultWarehouse = (value: string) => {
    setDefaultWarehouseName(value);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        warehouseName: value,
      })),
    );
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const payload = rows.map((row) => ({
            itemId: row.itemId,
            batchNumber: row.batchNumber || null,
            expiryDate: row.expiryDate || null,
            warehouseName: row.warehouseName || null,
            quantity: Number(row.quantity || 0),
            unitCost: Number(row.unitCost || 0),
          }));

          const formData = new FormData();
          formData.set("entryType", entryType);
          formData.set("transactionDate", date);
          formData.set("note", note);
          formData.set("items", JSON.stringify(payload));

          const result = await createStockEntry(formData);
          if (result?.error) {
            toast.error(result.error);
            return;
          }

          toast.success("Stock entry saved");
          router.push("/inventory/stock-entry");
          router.refresh();
        });
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Stock Entry</h1>
          <p className="text-sm text-muted-foreground">
            Create opening stock or receipt entries with one shared item table.
          </p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Entry"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Entry Type</label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="OPENING">Opening Stock</option>
            <option value="RECEIPT">Stock Receipt</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Default Warehouse</label>
          <Select
            value={warehouseOptions.find((option) => option.value === defaultWarehouseName) || null}
            onChange={(option) => applyDefaultWarehouse(option?.value || "")}
            options={warehouseOptions}
            className="react-select-container text-sm"
            classNamePrefix="react-select"
            placeholder="Apply to all items..."
            isClearable
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              menu: (base) => ({ ...base, zIndex: 9999 }),
            }}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Optional document note"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Warehouse</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Cost</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => {
                const selectedItem = items.find((item) => item.id === row.itemId);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 align-top">
                      <Select
                        value={itemOptions.find((option) => option.value === row.itemId) || null}
                        onChange={(option) => {
                          updateRow(row.id, "itemId", option?.value || "");
                          updateRow(row.id, "batchNumber", "");
                          updateRow(row.id, "expiryDate", "");
                        }}
                        options={itemOptions}
                        className="react-select-container text-sm"
                        classNamePrefix="react-select"
                        placeholder="Select item..."
                        isClearable
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                      />
                      {selectedItem ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Unit: {selectedItem.defaultUnit}{selectedItem.trackBatches ? " • Batch" : ""}{selectedItem.hasExpiry ? " • Expiry" : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Select
                        value={warehouseOptions.find((option) => option.value === row.warehouseName) || null}
                        onChange={(option) => updateRow(row.id, "warehouseName", option?.value || "")}
                        options={warehouseOptions}
                        className="react-select-container text-sm"
                        classNamePrefix="react-select"
                        placeholder="Select warehouse..."
                        isClearable
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", Number(e.target.value || 0))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-right text-sm text-foreground"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitCost}
                        onChange={(e) => updateRow(row.id, "unitCost", Number(e.target.value || 0))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-right text-sm text-foreground"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground align-top">
                      {formatNumber(Number(row.quantity || 0) * Number(row.unitCost || 0))}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailRowId(row.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRows((current) => (current.length > 1 ? current.filter((currentRow) => currentRow.id !== row.id) : current))
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-accent/20 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, createEmptyRow(defaultWarehouseName)])}
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </button>
          <div className="text-sm text-muted-foreground">{rows.length} line(s)</div>
        </div>
        <div className="grid gap-1 text-right text-sm">
          <div className="text-muted-foreground">Total Qty: <span className="font-medium text-foreground">{formatNumber(totalQty)}</span></div>
          <div className="text-muted-foreground">Total Value: <span className="font-medium text-foreground">{formatNumber(totalValue)}</span></div>
        </div>
      </div>

      <InventoryRowDetailsModal
        isOpen={!!detailRow}
        onClose={() => setDetailRowId(null)}
        title="Row Details"
        itemLabel={detailItem ? `${detailItem.name} (${detailItem.defaultUnit})` : undefined}
        description="Batch and expiry are optional and can be added here when needed."
        batchOptions={batchOptions}
        batchNumber={detailRow?.batchNumber || ""}
        expiryDate={detailRow?.expiryDate || ""}
        batchEnabled={!!detailItem?.trackBatches}
        expiryEnabled={!!detailItem?.hasExpiry}
        onBatchChange={(value) => {
          if (!detailRow) return;
          updateRow(detailRow.id, "batchNumber", value);
        }}
        onExpiryChange={(value) => {
          if (!detailRow) return;
          updateRow(detailRow.id, "expiryDate", value);
        }}
      />
    </form>
  );
}
