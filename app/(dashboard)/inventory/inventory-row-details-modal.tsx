"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import Select from "react-select";

type SelectOption = {
  value: string;
  label: string;
};

type InventoryRowDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemLabel?: string;
  description?: string;
  batchOptions: SelectOption[];
  warehouseOptions?: SelectOption[];
  batchNumber: string;
  expiryDate: string;
  warehouseName?: string;
  batchEnabled: boolean;
  expiryEnabled: boolean;
  warehouseEnabled?: boolean;
  onBatchChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onWarehouseChange?: (value: string) => void;
};

export default function InventoryRowDetailsModal({
  isOpen,
  onClose,
  title,
  itemLabel,
  description,
  batchOptions,
  warehouseOptions = [],
  batchNumber,
  expiryDate,
  warehouseName = "",
  batchEnabled,
  expiryEnabled,
  warehouseEnabled = false,
  onBatchChange,
  onExpiryChange,
  onWarehouseChange,
}: InventoryRowDetailsModalProps) {
  const menuPortalTarget = typeof window !== "undefined" ? document.body : undefined;

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border bg-accent/50 p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {itemLabel ? <p className="text-sm text-muted-foreground">{itemLabel}</p> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {onWarehouseChange ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Warehouse</label>
              <Select
                value={warehouseOptions.find((option) => option.value === warehouseName) || null}
                onChange={(option) => onWarehouseChange(option?.value || "")}
                options={warehouseOptions}
                className="react-select-container text-sm"
                classNamePrefix="react-select"
                placeholder={warehouseEnabled ? "Select warehouse..." : "Warehouse not required for this item"}
                isClearable
                isDisabled={!warehouseEnabled}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Batch</label>
            <Select
              value={batchOptions.find((option) => option.value === batchNumber) || null}
              onChange={(option) => onBatchChange(option?.value || "")}
              options={batchOptions}
              className="react-select-container text-sm"
              classNamePrefix="react-select"
              placeholder={batchEnabled ? "Select batch..." : "Batch not required for this item"}
              isClearable
              isDisabled={!batchEnabled}
              menuPortalTarget={menuPortalTarget}
              menuPosition="fixed"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Expiry</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => onExpiryChange(event.target.value)}
              disabled={!expiryEnabled}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-accent/20 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
