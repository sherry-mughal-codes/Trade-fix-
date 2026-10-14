"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import { updateCancelledSalarySlip } from "../../../actions";

export default function EditSalarySlipForm({
  slip,
}: {
  slip: {
    id: string;
    month: number;
    year: number;
    status: string;
    employee: { name: string } | null;
    ctcAmount: number;
    absentDays: number;
    payableAmount: number;
    bonus: number;
    deduction: number;
    finalPayableAmount: number;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [ctcAmount, setCtcAmount] = useState<number>(slip.ctcAmount);
  const [absentDays, setAbsentDays] = useState<number>(slip.absentDays);
  const [payableAmount, setPayableAmount] = useState<number>(slip.payableAmount);
  const [bonus, setBonus] = useState<number>(slip.bonus);
  const [deduction, setDeduction] = useState<number>(slip.deduction);
  const [finalPayableAmount, setFinalPayableAmount] = useState<number>(slip.finalPayableAmount);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const result = await updateCancelledSalarySlip(slip.id, {
      ctcAmount,
      absentDays,
      payableAmount,
      bonus,
      deduction,
      finalPayableAmount,
    });

    if (result.success) {
      toast.success("Salary slip updated");
      router.push(`/hr/salary-process/${slip.id}`);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update salary slip");
    }

    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Employee</div>
            <div className="text-sm font-medium text-foreground">{slip.employee?.name || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Month/Year</div>
            <div className="text-sm font-medium text-foreground">
              {String(slip.month).padStart(2, "0")}/{slip.year}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">CTC Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ctcAmount}
              onChange={(event) => setCtcAmount(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Absent Days</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={absentDays}
              onChange={(event) => setAbsentDays(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payable Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={payableAmount}
              onChange={(event) => setPayableAmount(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bonus</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bonus}
              onChange={(event) => setBonus(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deduction</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={deduction}
              onChange={(event) => setDeduction(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Final Payable Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={finalPayableAmount}
              onChange={(event) => setFinalPayableAmount(parseFloat(event.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-medium"
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-[140px] items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
