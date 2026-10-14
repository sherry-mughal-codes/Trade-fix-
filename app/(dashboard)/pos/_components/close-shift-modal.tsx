"use client";

import { useState } from "react";
import { X, LogOut, Loader2, Banknote, CreditCard, Building2, Wallet } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { closeShiftClient } from "../_actions_client";

interface CloseShiftModalProps {
  open: boolean;
  onClose: () => void;
  shiftId: string;
  expected: {
    cash: number;
    card: number;
    bank: number;
    wallet: number;
    openingFloat: number;
  };
}

export default function CloseShiftModal({ open, onClose, shiftId, expected }: CloseShiftModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cashClosing, setCashClosing] = useState<string>("");
  const [cardClosing, setCardClosing] = useState<string>("");
  const [bankClosing, setBankClosing] = useState<string>("");
  const [walletClosing, setWalletClosing] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("shiftId", shiftId);
    formData.set("closeNotes", closeNotes);
    const closingJson = JSON.stringify({
      cashClosing: cashClosing ? Number(cashClosing) : null,
      cardClosing: cardClosing ? Number(cardClosing) : null,
      bankClosing: bankClosing ? Number(bankClosing) : null,
      walletClosing: walletClosing ? Number(walletClosing) : null,
    });
    formData.set("closingJson", closingJson);

    setLoading(true);
    try {
      const result = await closeShiftClient(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Shift closed successfully");
      onClose();
      router.push("/pos");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `Rs ${n.toFixed(2)}`;
  const cashTotal = expected.openingFloat + expected.cash;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Close Register</h2>
              <p className="text-xs text-muted-foreground">Count and enter amounts before closing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Cash Expected
                </span>
                <span className="font-semibold text-foreground">{fmt(cashTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Card Expected
                </span>
                <span className="font-semibold text-foreground">{fmt(expected.card)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Bank Expected
                </span>
                <span className="font-semibold text-foreground">{fmt(expected.bank)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Wallet Expected
                </span>
                <span className="font-semibold text-foreground">{fmt(expected.wallet)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Counted Amounts</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-green-600" /> Cash Closing
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashClosing}
                    onChange={(e) => setCashClosing(e.target.value)}
                    placeholder={cashTotal.toFixed(2)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-blue-600" /> Card Closing
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardClosing}
                    onChange={(e) => setCardClosing(e.target.value)}
                    placeholder={expected.card.toFixed(2)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-indigo-600" /> Bank Closing
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bankClosing}
                    onChange={(e) => setBankClosing(e.target.value)}
                    placeholder={expected.bank.toFixed(2)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-purple-600" /> Wallet Closing
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={walletClosing}
                    onChange={(e) => setWalletClosing(e.target.value)}
                    placeholder={expected.wallet.toFixed(2)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Closing Notes</label>
              <textarea
                rows={3}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Any discrepancies or notes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Closing..." : "Close Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
