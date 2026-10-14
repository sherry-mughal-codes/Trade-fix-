"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Select from "react-select";

type ItemOption = {
  value: string;
  label: string;
};

type LedgerFiltersProps = {
  itemOptions: ItemOption[];
  initialItemId: string;
  initialFrom: string;
  initialTo: string;
  initialMovementType: string;
  initialSourceType: string;
};

const movementTypeOptions: ItemOption[] = [
  { value: "OPENING", label: "Opening" },
  { value: "MANUAL_RECEIPT", label: "Manual Receipt" },
  { value: "MANUAL_ISSUE", label: "Manual Issue" },
  { value: "ADJUSTMENT_IN", label: "Adjustment In" },
  { value: "ADJUSTMENT_OUT", label: "Adjustment Out" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "CANCELLATION", label: "Cancellation" },
];

const sourceTypeOptions: ItemOption[] = [
  { value: "STOCK_ENTRY", label: "Stock Entry" },
  { value: "STOCK_ADJUSTMENT", label: "Stock Adjustment" },
  { value: "INVOICE", label: "Invoice" },
];

export default function LedgerFilters({
  itemOptions,
  initialItemId,
  initialFrom,
  initialTo,
  initialMovementType,
  initialSourceType,
}: LedgerFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const menuPortalTarget = typeof window !== "undefined" ? document.body : undefined;

  const [itemId, setItemId] = useState(initialItemId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [movementType, setMovementType] = useState(initialMovementType);
  const [sourceType, setSourceType] = useState(initialSourceType);

  const selectedItem = useMemo(
    () => itemOptions.find((option) => option.value === itemId) || null,
    [itemId, itemOptions],
  );
  const selectedMovementType = useMemo(
    () => movementTypeOptions.find((option) => option.value === movementType) || null,
    [movementType],
  );
  const selectedSourceType = useMemo(
    () => sourceTypeOptions.find((option) => option.value === sourceType) || null,
    [sourceType],
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (itemId) params.set("itemId", itemId);
    else params.delete("itemId");

    if (from) params.set("from", from);
    else params.delete("from");

    if (to) params.set("to", to);
    else params.delete("to");

    if (movementType) params.set("movementType", movementType);
    else params.delete("movementType");

    if (sourceType) params.set("sourceType", sourceType);
    else params.delete("sourceType");

    params.delete("page");

    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const clearFilters = () => {
    setItemId("");
    setFrom("");
    setTo("");
    setMovementType("");
    setSourceType("");
    router.push(pathname);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Item</label>
          <Select
            value={selectedItem}
            onChange={(option) => setItemId(option?.value || "")}
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
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">From Date</label>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-minia-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">To Date</label>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-minia-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Movement Type</label>
          <Select
            value={selectedMovementType}
            onChange={(option) => setMovementType(option?.value || "")}
            options={movementTypeOptions}
            className="react-select-container text-sm"
            classNamePrefix="react-select"
            placeholder="All types"
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
          <label className="text-sm font-medium text-foreground">Source</label>
          <Select
            value={selectedSourceType}
            onChange={(option) => setSourceType(option?.value || "")}
            options={sourceTypeOptions}
            className="react-select-container text-sm"
            classNamePrefix="react-select"
            placeholder="All sources"
            isClearable
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              menu: (base) => ({ ...base, zIndex: 9999 }),
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Pick an item first, then narrow by date, movement type, or source to keep the ledger focused.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
