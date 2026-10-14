"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, X, Plus, Check } from "lucide-react";

export type FilterType = "text" | "number" | "select" | "date";

export interface FilterField {
  name: string;
  label: string;
  type: FilterType;
  options?: { label: string; value: string }[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const OPERATORS: Record<FilterType, { label: string; value: string }[]> = {
  text: [
    { label: "Contains", value: "contains" },
    { label: "Equals", value: "equals" },
    { label: "Starts with", value: "startsWith" },
    { label: "Ends with", value: "endsWith" },
  ],
  number: [
    { label: "Equals", value: "equals" },
    { label: "Greater than", value: "gt" },
    { label: "Less than", value: "lt" },
    { label: "Greater than or equal", value: "gte" },
    { label: "Less than or equal", value: "lte" },
  ],
  select: [
    { label: "Is", value: "equals" },
    { label: "Is not", value: "not" },
  ],
  date: [
    { label: "Is", value: "equals" },
    { label: "Before", value: "lt" },
    { label: "After", value: "gt" },
  ],
};

const INPUT_CLASS =
  "w-full px-3 py-2 text-sm bg-background border border-input text-foreground rounded-md focus:border-minia-primary focus:ring-minia-primary placeholder:text-muted-foreground";

export default function DynamicFilter({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);

  useEffect(() => {
    const filterParam = searchParams.get("filters");
    if (filterParam) {
      try {
        const parsedFilters = JSON.parse(atob(filterParam));
        setFilters(parsedFilters);
      } catch (error) {
        console.error("Failed to parse filters from URL", error);
      }
    } else {
      setFilters([]);
    }
  }, [searchParams]);

  const addFilter = () => {
    const firstField = fields[0];
    if (!firstField) return;

    setFilters([
      ...filters,
      {
        id: Math.random().toString(36).substr(2, 9),
        field: firstField.name,
        operator: OPERATORS[firstField.type][0].value,
        value: "",
      },
    ]);
  };

  const applyFilters = (currentFilters: FilterCondition[]) => {
    const params = new URLSearchParams(searchParams.toString());
    const validFilters = currentFilters.filter((filter) => filter.value.trim() !== "");

    if (validFilters.length > 0) {
      params.set("filters", btoa(JSON.stringify(validFilters)));
    } else {
      params.delete("filters");
    }

    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const removeFilter = (id: string) => {
    const newFilters = filters.filter((filter) => filter.id !== id);
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const updateFilter = (id: string, key: keyof FilterCondition, value: string) => {
    const newFilters = filters.map((filter) => {
      if (filter.id !== id) return filter;

      const updatedFilter: FilterCondition = { ...filter, [key]: value } as FilterCondition;

      if (key === "field") {
        const fieldConfig = fields.find((field) => field.name === value);
        if (fieldConfig) {
          updatedFilter.operator = OPERATORS[fieldConfig.type][0].value;
          updatedFilter.value = "";
        }
      }

      return updatedFilter;
    });

    setFilters(newFilters);
  };

  const handleApply = () => {
    applyFilters(filters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setFilters([]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("filters");
    router.replace(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };

  const activeFilterCount = filters.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
          activeFilterCount > 0
            ? "bg-minia-primary/10 text-minia-primary border-minia-primary/20"
            : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground"
        }`}
      >
        <Filter className="h-4 w-4" />
        Filter
        {activeFilterCount > 0 ? (
          <span className="flex items-center justify-center w-5 h-5 ml-1 text-xs text-primary-foreground bg-minia-primary rounded-full">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 w-[600px] mt-2 bg-popover border border-border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Filters</h3>
              <div className="flex gap-2">
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1">
                  Clear all
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No active filters. Click &quot;Add Filter&quot; to start.</div>
              ) : (
                filters.map((filter) => {
                  const fieldConfig = fields.find((field) => field.name === filter.field);
                  if (!fieldConfig) return null;

                  const operators = OPERATORS[fieldConfig.type];

                  return (
                    <div key={filter.id} className="flex gap-2 items-center bg-accent/50 p-2 rounded-md">
                      <div className="w-1/3">
                        <select
                          className={INPUT_CLASS}
                          value={filter.field}
                          onChange={(e) => updateFilter(filter.id, "field", e.target.value)}
                        >
                          {fields.map((field) => (
                            <option key={field.name} value={field.name}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-1/4">
                        <select
                          className={INPUT_CLASS}
                          value={filter.operator}
                          onChange={(e) => updateFilter(filter.id, "operator", e.target.value)}
                        >
                          {operators.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {fieldConfig.type === "select" && fieldConfig.options ? (
                        <select
                          className={`${INPUT_CLASS} flex-1`}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                        >
                          <option value="">Select...</option>
                          {fieldConfig.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={fieldConfig.type === "number" ? "number" : fieldConfig.type === "date" ? "date" : "text"}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                          placeholder="Value..."
                          className={`${INPUT_CLASS} flex-1`}
                        />
                      )}

                      <button onClick={() => removeFilter(filter.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t border-border">
              <button onClick={addFilter} className="flex items-center text-sm text-minia-primary hover:text-minia-primary/80">
                <Plus className="h-4 w-4 mr-1" />
                Add Filter
              </button>

              <button
                onClick={handleApply}
                className="flex items-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
              >
                <Check className="h-4 w-4 mr-2" />
                Apply Filters
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
