"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import { deleteJournalEntry } from "./actions";

export const JOURNAL_FILTER_FIELDS: FilterField[] = [
  { name: "entryNumber", label: "Entry #", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "description", label: "Description", type: "text" },
  { name: "reference", label: "Reference", type: "text" },
];

export type JournalEntryRow = {
  id: string;
  entryNumber: string;
  date: string | Date;
  description: string | null;
  reference: string | null;
  totalDebit?: number;
  totalCredit?: number;
  rows?: any[];
  [key: string]: any;
};

type Props = {
  journals: JournalEntryRow[];
  totalCount: number;
  page: number;
  limit: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function JournalPageClient({ journals, totalCount, page, limit, canCreate, canEdit, canDelete }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const handleDelete = (entry: JournalEntryRow) => async () => {
    const res = await deleteJournalEntry(entry.id);
    startTransition(() => {
      router.refresh();
    });
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">General Ledger Entries</p>
        </div>
        {canCreate ? (
          <Link
            href="/journal/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Link>
        ) : null}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
        <SearchInput placeholder="Search entries..." />
        <DynamicFilter fields={JOURNAL_FILTER_FIELDS} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Entry #</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Date</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Description</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Total Debit</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Total Credit</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {journals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No journal entries found
                  </td>
                </tr>
              ) : (
                journals.map((entry) => {
                  const totalDebit = Number(
                    entry.totalDebit ??
                      (entry.rows?.reduce((sum: number, row: any) => sum + Number(row.debit || 0), 0) || 0),
                  );
                  const totalCredit = Number(
                    entry.totalCredit ??
                      (entry.rows?.reduce((sum: number, row: any) => sum + Number(row.credit || 0), 0) || 0),
                  );
                  const viewData = {
                    ...entry,
                    rows: entry.rows || [],
                  };

                  return (
                    <tr key={entry.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-minia-primary">{entry.entryNumber}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-foreground max-w-xs truncate">
                        {entry.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-foreground">
                        {totalDebit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-foreground">
                        {totalCredit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RowActions
                          id={entry.id}
                          viewData={viewData}
                          editUrl={canEdit ? `/journal/${entry.id}/edit` : undefined}
                          onDelete={canDelete ? handleDelete(entry) : undefined}
                          type="journal"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={limit}
        />
      </div>
    </div>
  );
}
