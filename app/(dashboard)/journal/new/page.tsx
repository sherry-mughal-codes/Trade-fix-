import { prisma } from "@/lib/prisma";
import JournalForm from "../journal-form";
import { requirePageAccess } from "@/lib/rbac";
import { getNextJournalSequence } from "../numbering";
import { requireOrganizationId } from "@/lib/tenant-db";

export default async function NewJournalEntryPage() {
  await requirePageAccess("journal.create", "/journal");
  const organizationId = await requireOrganizationId();
  const [accounts, settings] = await Promise.all([
    prisma.account.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    }),
    prisma.companySettings.findFirst({ where: { organizationId } }),
  ]);

  const prefix = settings?.journalPrefix || "JRN-"
  const existingEntries = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      entryNumber: {
        startsWith: prefix,
      },
    },
    select: {
      entryNumber: true,
    },
  })
  const { entryNumber: nextEntryNumber } = getNextJournalSequence(
    settings,
    existingEntries.map((entry) => entry.entryNumber),
  )

  return (
    <div className="space-y-6">
      <JournalForm 
        accounts={accounts} 
        defaultEntryNumber={nextEntryNumber}
      />
    </div>
  );
}
