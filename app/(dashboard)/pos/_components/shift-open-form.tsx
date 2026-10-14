"use client";

import { useState } from "react";
import { Store, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { openShift } from "../actions";

interface POSProfile {
  id: string;
  name: string;
  code?: string | null;
  posCounter?: {
    name: string;
  } | null;
  walkinCustomer?: {
    name: string;
  } | null;
}

interface ShiftOpenFormProps {
  availableProfiles: POSProfile[];
}

export default function ShiftOpenForm({ availableProfiles }: ShiftOpenFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(availableProfiles[0]?.id || "");

  const handleSubmit = async (formData: FormData) => {
    if (!selectedProfileId) {
      toast.error("Please select a POS profile");
      return;
    }
    formData.set("posProfileId", selectedProfileId);
    setLoading(true);
    try {
      const result = await openShift(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Shift opened successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-minia-primary to-minia-primary/80 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Open Counter Shift</h1>
              <p className="text-sm text-white/80">Select a profile and opening float to begin</p>
            </div>
          </div>
        </div>

        <form action={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">POS Profile</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availableProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                    selectedProfileId === profile.id
                      ? "border-minia-primary bg-minia-primary/5 ring-1 ring-minia-primary"
                      : "border-border hover:border-minia-primary/40 hover:bg-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="profileSelect"
                    checked={selectedProfileId === profile.id}
                    onChange={() => setSelectedProfileId(profile.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{profile.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Counter: {profile.posCounter?.name || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Walk-in: {profile.walkinCustomer?.name || "—"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="openingFloat" className="text-sm font-medium text-foreground">
              Opening Float
            </label>
            <input
              id="openingFloat"
              name="openingFloat"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">Cash in drawer at start of shift</p>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedProfileId}
            className="w-full inline-flex items-center justify-center rounded-lg bg-minia-primary px-4 py-3 text-base font-semibold text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {loading ? "Opening Shift..." : "Open Shift"}
          </button>
        </form>
      </div>
    </div>
  );
}
