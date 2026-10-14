import { prisma } from "@/lib/prisma";
import SettingsForm from "./settings-form";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";
import { ensureDefaultAccountsForOrganization } from "@/lib/organization-bootstrap";

const prismaAny = prisma as any;

export default async function SettingsPage() {
  await requirePageAccess("settings.access", "/");
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  await ensureDefaultAccountsForOrganization(prismaAny, organizationId);

  const [settingsData, currencies, accounts] = await Promise.all([
    prismaAny.companySettings.findFirst({ where: { organizationId } }),
    prismaAny.currency.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    prismaAny.account.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const settings = settingsData
    ? {
        ...(settingsData as any),
        createdAt: settingsData.createdAt.toISOString(),
        updatedAt: settingsData.updatedAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your company details and preferences</p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <SettingsForm initialSettings={settings} currencies={currencies} accounts={accounts} />
      </div>
    </div>
  );
}
