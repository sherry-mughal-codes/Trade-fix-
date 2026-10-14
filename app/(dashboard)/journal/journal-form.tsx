"use client";

import { useState } from "react";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar } from "lucide-react";
import Link from "next/link";
import { createJournalEntry, updateJournalEntry } from "./actions";
import { toast } from "react-hot-toast";
import Select from "react-select";

type Account = {
  id: string;
  name: string;
  code: string | null;
  type: string;
};

type JournalRow = {
  id: string;
  accountId: string;
  description: string;
  debit: number;
  credit: number;
};

interface JournalFormProps {
  accounts: Account[];
  defaultEntryNumber: string;
  initialData?: any;
  isLinked?: boolean;
}

export default function JournalForm({ accounts, defaultEntryNumber, initialData, isLinked = false }: JournalFormProps) {
  const [loading, setLoading] = useState(false);
  const menuPortalTarget = typeof window !== "undefined" ? document.body : undefined;
  const [rows, setRows] = useState<JournalRow[]>(
    initialData?.rows?.map((row: any) => ({
      id: row.id,
      accountId: row.accountId,
      description: row.description || '',
      debit: row.debit,
      credit: row.credit
    })) || [
    { id: '1', accountId: '', description: '', debit: 0, credit: 0 },
    { id: '2', accountId: '', description: '', debit: 0, credit: 0 },
  ]);

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleAddRow = () => {
    setRows([
      ...rows,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        accountId: '', 
        description: '', 
        debit: 0, 
        credit: 0 
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 2) {
        toast.error("A journal entry must have at least 2 rows");
        return;
    }
    setRows(rows.filter(row => row.id !== id));
  };

  const handleRowChange = (id: string, field: keyof JournalRow, value: any) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        
        // If debit is entered, credit must be 0 and vice versa
        if (field === 'debit' && value > 0) updatedRow.credit = 0;
        if (field === 'credit' && value > 0) updatedRow.debit = 0;
        
        return updatedRow;
      }
      return row;
    }));
  };

  const handleSubmit = async (formData: FormData) => {
    if (!isBalanced) {
      toast.error("Journal entry must be balanced (Total Debit = Total Credit)");
      return;
    }

    if (totalDebit === 0) {
        toast.error("Journal entry amounts cannot be zero");
        return;
    }

    setLoading(true);

    // Add rows to formData
    formData.set('rowsData', JSON.stringify(rows));

    try {
      let result;
      if (initialData) {
        result = await updateJournalEntry(initialData.id, formData);
      } else {
        result = await createJournalEntry(formData);
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Journal entry ${initialData ? 'updated' : 'created'} successfully!`);
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/journal"
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {initialData ? 'Edit Journal Entry' : 'New Journal Entry'}
            </h1>
            <p className="text-sm text-muted-foreground">
              General Ledger Entry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/journal"
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent"
          >
            Cancel
          </Link>
          {!isLinked && (
            <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-white text-sm font-medium rounded-md hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
            >
                {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                </>
                ) : (
                "Save"
                )}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium text-foreground">
                    Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <input
                        type="date"
                        id="date"
                        name="date"
                        required
                        defaultValue={initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                        onClick={(e) => !isLinked && (e.target as HTMLInputElement).showPicker()}
                        readOnly={isLinked}
                        className={`w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                    />
                    {!isLinked && <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />}
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="entryNumber" className="text-sm font-medium text-foreground">
                    Journal #
                </label>
                <input
                    type="text"
                    id="entryNumber"
                    name="entryNumber"
                    defaultValue={defaultEntryNumber}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm bg-muted/50 text-muted-foreground cursor-not-allowed focus:outline-none"
                    readOnly
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="reference" className="text-sm font-medium text-foreground">
                    Reference
                </label>
                <input
                    type="text"
                    id="reference"
                    name="reference"
                    defaultValue={initialData?.reference || ''}
                    readOnly={isLinked}
                    className={`w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                    placeholder="e.g. INV-001 Adjustment"
                />
            </div>
        </div>

        <div className="mb-6">
            <label htmlFor="description" className="text-sm font-medium text-foreground block mb-2">
                Description
            </label>
            <textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={initialData?.description || ''}
                readOnly={isLinked}
                className={`w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                placeholder="Brief description of this entry..."
            />
        </div>

        <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
                <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                        <th className="pb-3 w-[35%]">Account</th>
                        <th className="pb-3 w-[25%]">Description (Optional)</th>
                        <th className="pb-3 w-[15%] text-right">Debit</th>
                        <th className="pb-3 w-[15%] text-right">Credit</th>
                        <th className="pb-3 w-[5%]"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                        <tr key={row.id} className="group">
                            <td className="py-3 pr-4">
                                <Select
                                    isDisabled={isLinked}
                                    options={accounts.map((acc) => ({
                                        value: acc.id,
                                        label: `${acc.code ? acc.code + ' - ' : ''}${acc.name} (${acc.type})`
                                    }))}
                                    value={row.accountId ? {
                                        value: row.accountId,
                                        label: accounts.find(a => a.id === row.accountId) 
                                            ? `${accounts.find(a => a.id === row.accountId)?.code ? accounts.find(a => a.id === row.accountId)?.code + ' - ' : ''}${accounts.find(a => a.id === row.accountId)?.name} (${accounts.find(a => a.id === row.accountId)?.type})`
                                            : ""
                                    } : null}
                                    onChange={(option) => handleRowChange(row.id, 'accountId', option?.value || "")}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select account..."
                                    menuPortalTarget={menuPortalTarget}
                                    menuPosition="fixed"
                                    styles={{
                                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                      menu:       (base) => ({ ...base, zIndex: 9999 }),
                                    }}
                                />
                            </td>
                            <td className="py-3 pr-4">
                                <input
                                    type="text"
                                    value={row.description}
                                    readOnly={isLinked}
                                    onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                                    className={`w-full px-2 py-1.5 text-sm border border-input rounded focus:border-minia-primary focus:ring-0 ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                                    placeholder="Line description"
                                />
                            </td>
                            <td className="py-3 pr-4">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.debit || ''}
                                    readOnly={isLinked}
                                    onChange={(e) => handleRowChange(row.id, 'debit', parseFloat(e.target.value) || 0)}
                                    className={`w-full px-2 py-1.5 text-sm border border-input rounded focus:border-minia-primary focus:ring-0 text-right ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                                    placeholder="0.00"
                                />
                            </td>
                            <td className="py-3 pr-4">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.credit || ''}
                                    readOnly={isLinked}
                                    onChange={(e) => handleRowChange(row.id, 'credit', parseFloat(e.target.value) || 0)}
                                    className={`w-full px-2 py-1.5 text-sm border border-input rounded focus:border-minia-primary focus:ring-0 text-right ${isLinked ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background text-foreground'}`}
                                    placeholder="0.00"
                                />
                            </td>
                            <td className="py-3 text-center">
                                {!isLinked && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRow(row.id)}
                                        className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/50">
                    <tr>
                        <td colSpan={2} className="py-3 pr-4 text-right font-medium text-foreground">Total</td>
                        <td className="py-3 pr-4 text-right font-bold text-foreground">{totalDebit.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right font-bold text-foreground">{totalCredit.toFixed(2)}</td>
                        <td></td>
                    </tr>
                    {!isBalanced && (
                        <tr>
                            <td colSpan={5} className="py-2 text-center text-xs text-destructive bg-destructive/10">
                                Entry is not balanced. Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                            </td>
                        </tr>
                    )}
                </tfoot>
            </table>
        </div>
        
        {!isLinked && (
            <button
                type="button"
                onClick={handleAddRow}
                className="mt-4 flex items-center text-sm text-minia-primary hover:opacity-90 font-medium"
            >
                <Plus className="h-4 w-4 mr-1" />
                Add Line
            </button>
        )}
      </div>
    </form>  );
}
