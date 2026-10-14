import { prisma } from "@/lib/prisma";
import JournalForm from "../../journal-form";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export default async function EditJournalEntryPage({ params }: { params: { id: string } }) {
  await requirePageAccess("journal.action.edit", "/journal");
  const organizationId = await requireOrganizationId();
  const [accounts, entry] = await Promise.all([
    prisma.account.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    }),
    prisma.journalEntry.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
      include: {
        rows: true,
        invoice: true,
        payment: true,
      }
    }),
  ]);

  if (!entry) {
    notFound();
  }

  // Check if linked to invoice or payment
  const isLinked = !!(entry.invoice || entry.payment);

  return (
    <div className="space-y-6">
      {isLinked && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
          This journal entry is linked to an {entry.invoice ? 'invoice' : 'payment'} and cannot be edited directly.
        </div>
      )}

      <JournalForm 
        accounts={accounts} 
        defaultEntryNumber={entry.entryNumber}
        initialData={entry}
        isLinked={isLinked}
      />
    </div>
  );
}
