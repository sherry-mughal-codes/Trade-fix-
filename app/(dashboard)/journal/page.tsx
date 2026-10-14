import { prisma } from "@/lib/prisma";
import JournalPageClient, { JournalEntryRow } from "./journal-page-client";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
  };
}) {
  await requirePageAccess("journal.list", "/");
  const organizationId = await requireOrganizationId();
  const canCreate = await hasPermission("journal.create");
  const canEdit = await hasPermission("journal.action.edit");
  const canDelete = await hasPermission("journal.action.delete");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    OR: [
      { entryNumber: { contains: query } },
      { description: { contains: query } },
      { reference: { contains: query } },
    ],
  });

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        const filterConditions = filters.map((filter: any) => {
          const { field, operator, value } = filter;

          switch (operator) {
            case "contains":
              return { [field]: { contains: value } };
            case "equals":
              return { [field]: { equals: value } };
            case "startsWith":
              return { [field]: { startsWith: value } };
            case "endsWith":
              return { [field]: { endsWith: value } };
            case "not":
              return { [field]: { not: value } };
            case "gt":
              return { [field]: { gt: Number(value) } };
            case "lt":
              return { [field]: { lt: Number(value) } };
            case "gte":
              return { [field]: { gte: Number(value) } };
            case "lte":
              return { [field]: { lte: Number(value) } };
            default:
              return {};
          }
        });

        whereClause = {
          AND: [whereClause, ...filterConditions],
        };
      }
    } catch (e) {
      console.error("Failed to parse filters", e);
    }
  }

  const [journals, totalCount] = await Promise.all([
    prisma.journalEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        rows: {
          include: {
            account: true,
          },
        },
      },
      take: limit,
      skip,
    }),
    prisma.journalEntry.count({ where: whereClause }),
  ]);

  const rows: JournalEntryRow[] = journals.map((entry) => {
    const totalDebit = entry.rows.reduce((s: number, r: any) => s + Number(r.debit || 0), 0);
    const totalCredit = entry.rows.reduce((s: number, r: any) => s + Number(r.credit || 0), 0);
    return {
      ...(entry as any),
      totalDebit,
      totalCredit,
    };
  });

  return (
    <JournalPageClient
      journals={rows}
      totalCount={totalCount}
      page={page}
      limit={limit}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}

