import { prisma } from "@/lib/prisma";
import DataSettingsTabs from "./data-settings-tabs";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId } from "@/lib/tenant-db";
import { ensureDefaultAccountsForOrganization } from "@/lib/organization-bootstrap";

export default async function DataSettingsPage() {
  await requirePageAccess("settings.data.access", "/");
  const organizationId = await requireOrganizationId();

  await ensureDefaultAccountsForOrganization(prisma as any, organizationId);
  const [accounts, journalRows] = await Promise.all([
    prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: { parent: true },
    }),
    prisma.journalRow.groupBy({
      by: ["accountId"],
      where: { organizationId },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const rowMap = new Map<string, { debit: number; credit: number }>();
  for (const r of journalRows) {
    rowMap.set(r.accountId, {
      debit: Number(r._sum.debit || 0),
      credit: Number(r._sum.credit || 0),
    });
  }

  const accountsWithBalance = accounts.map((acc) => {
    const sums = rowMap.get(acc.id) || { debit: 0, credit: 0 };
    const isDebitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
    const balance = isDebitNormal
      ? sums.debit - sums.credit
      : sums.credit - sums.debit;
    return {
      ...acc,
      balance,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage account groups, leaf accounts, and the account hierarchy.</p>
        </div>
      </div>

      <DataSettingsTabs accounts={accountsWithBalance} />
    </div>
  );
}
