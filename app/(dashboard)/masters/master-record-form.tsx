"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

type MasterRecordFormData = {
  id: string;
  name: string;
  isActive: boolean;
};

interface MasterRecordFormProps {
  initialData?: MasterRecordFormData | null;
  label: string;
  listPath: string;
  description: string;
  saveAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; redirectUrl?: string }>;
}

export default function MasterRecordForm({
  initialData,
  label,
  listPath,
  description,
  saveAction,
}: MasterRecordFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const result = await saveAction(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${label} ${isEditing ? "updated" : "created"} successfully`);
      router.push(result?.redirectUrl || listPath);
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
          <Link href={listPath} className="rounded-full p-2 transition-colors hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{isEditing ? `Edit ${label}` : `New ${label}`}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : `Save ${label}`}
        </button>
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">{label} Name</label>
            <input
              id="name"
              name="name"
              required
              defaultValue={initialData?.name || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
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
        </div>
      </div>
    </form>
  );
}
