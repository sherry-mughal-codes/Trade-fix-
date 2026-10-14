"use client";

import { X, Calendar, FileText, Hash } from "lucide-react";
import { useEffect, useRef } from "react";

type Account = {
  id: string;
  name: string;
  code: string | null;
  type: string;
};

type JournalRow = {
  id: string;
  accountId: string;
  account: Account;
  description: string | null;
  debit: number;
  credit: number;
};

type JournalEntry = {
  id: string;
  entryNumber: string;
  date: string; // or Date
  description: string | null;
  reference: string | null;
  rows: JournalRow[];
};

interface JournalDetailsModalProps {
  journal: JournalEntry;
  isOpen: boolean;
  onClose: () => void;
}

export default function JournalDetailsModal({ journal, isOpen, onClose }: JournalDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalDebit = journal.rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = journal.rows.reduce((sum, row) => sum + row.credit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-accent/50">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                {journal.entryNumber}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Journal Entry Details</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
            {/* Meta Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-accent/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        Date
                    </div>
                    <div className="font-medium text-foreground">
                        {new Date(journal.date).toLocaleDateString()}
                    </div>
                </div>
                
                <div className="p-4 bg-accent/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Hash className="h-4 w-4" />
                        Reference
                    </div>
                    <div className="font-medium text-foreground">
                        {journal.reference || '-'}
                    </div>
                </div>

                <div className="p-4 bg-accent/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FileText className="h-4 w-4" />
                        Description
                    </div>
                    <div className="font-medium text-foreground truncate" title={journal.description || ''}>
                        {journal.description || '-'}
                    </div>
                </div>
            </div>

            {/* Rows Table */}
            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-accent text-muted-foreground font-medium border-b border-border">
                        <tr>
                            <th className="px-6 py-3 w-[40%]">Account</th>
                            <th className="px-6 py-3 w-[30%]">Description</th>
                            <th className="px-6 py-3 w-[15%] text-right">Debit</th>
                            <th className="px-6 py-3 w-[15%] text-right">Credit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {journal.rows.map((row) => (
                            <tr key={row.id} className="hover:bg-accent/50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-foreground">
                                        {row.account.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.account.code && <span className="mr-1">{row.account.code} •</span>}
                                        {row.account.type}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {row.description || '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-foreground">
                                    {row.debit > 0 ? row.debit.toFixed(2) : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-foreground">
                                    {row.credit > 0 ? row.credit.toFixed(2) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-accent font-semibold border-t border-border">
                        <tr>
                            <td colSpan={2} className="px-6 py-3 text-right text-foreground">Total</td>
                            <td className="px-6 py-3 text-right text-minia-primary">
                                {totalDebit.toFixed(2)}
                            </td>
                            <td className="px-6 py-3 text-right text-minia-primary">
                                {totalCredit.toFixed(2)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-accent/20 border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
