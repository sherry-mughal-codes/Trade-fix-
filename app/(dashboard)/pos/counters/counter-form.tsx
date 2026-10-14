"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createCounter, updateCounter } from "../actions";

type WarehouseOption = { name: string };

type CounterFormData = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  linkedWarehouseName?: string | null;
  notes?: string | null;
};

interface CounterFormProps {
  initialData?: CounterFormData | null;
  warehouses: WarehouseOption[];
}

export default function CounterForm({ initialData, warehouses }: CounterFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const result = isEditing && initialData
        ? await updateCounter(initialData.id, formData)
        : await createCounter(formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Counter ${isEditing ? "updated" : "created"} successfully`);
      router.push(result?.redirectUrl || "/pos/counters");
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
          <Link href="/pos/counters" className="rounded-full p-2 transition-colors hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? "Edit Counter" : "New Counter"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update counter settings and linked warehouse."
                : "Add a new POS counter for shift and invoice attribution."}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : "Save Counter"}
        </button>
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Counter Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={initialData?.name || ""}
                placeholder="e.g. Main Counter"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-foreground">
                Short Code
              </label>
              <input
                id="code"
                name="code"
                defaultValue={initialData?.code || ""}
                placeholder="e.g. C-01"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="linkedWarehouseName" className="text-sm font-medium text-foreground">
                Linked Warehouse
              </label>
              <select
                id="linkedWarehouseName"
                name="linkedWarehouseName"
                defaultValue={initialData?.linkedWarehouseName || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">— Not linked —</option>
                {warehouses.map((w) => (
                  <option key={w.name} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                Status
              </label>
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

            <div className="md:col-span-2 space-y-2">
              <label htmlFor="notes" className="text-sm font-medium text-foreground">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={initialData?.notes || ""}
                placeholder="Optional notes about this counter..."
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
