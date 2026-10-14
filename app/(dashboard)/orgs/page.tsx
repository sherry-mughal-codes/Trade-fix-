import { DEFAULT_ENABLED_MODULES } from "@/lib/organization-bootstrap";
import { getPermissionContext } from "@/lib/rbac";
import { getSuperadminOrganizations } from "@/lib/tenancy";
import { redirect } from "next/navigation";
import ConfirmSubmitButton from "./confirm-submit-button";

import {
  clearOrganizationTransactions,
  clearOrganizationSwitch,
  createOrganization,
  disableOrganization,
  enableOrganization,
  loadOrganizationDemoData,
  switchOrganization,
  updateOrganizationModules,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: { success?: string };
}) {
  const ctx = await getPermissionContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/login");
  }
  if (!ctx.isSuperadmin) {
    redirect("/");
  }
  if (ctx.activeOrganizationId) {
    redirect("/");
  }

  const organizations = await getSuperadminOrganizations();
  const successMessage = typeof searchParams?.success === "string" ? searchParams.success : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
        <p className="text-sm text-muted-foreground">Switch into an org, disable access, control enabled modules, clear transactions, and load demo data.</p>
      </div>

      {successMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      ) : null}

      <details className="bg-card rounded-lg shadow-sm border border-border p-6 group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add New Org</h2>
            <p className="text-sm text-muted-foreground">Creates the organization, owner user, default roles, and baseline settings.</p>
          </div>
          <span className="text-xs font-medium text-muted-foreground group-open:hidden">Expand</span>
          <span className="hidden text-xs font-medium text-muted-foreground group-open:block">Collapse</span>
        </summary>
        <form action={createOrganization} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input name="organizationName" required placeholder="Organization name" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="ownerName" required placeholder="Owner name" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="ownerEmail" type="email" placeholder="Owner email (optional)" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="ownerUsername" placeholder="Owner username" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="ownerPassword" required type="password" minLength={6} placeholder="Owner password" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="firstBankAccountName" required placeholder="First bank account (e.g. HBL Current)" className="h-10 px-3 border border-input bg-background rounded-md" />
          <input name="firstBankAccountCode" placeholder="Bank account code (optional, default 1201)" defaultValue="1201" className="h-10 px-3 border border-input bg-background rounded-md" />
          <div className="md:col-span-2 space-y-2">
            <div className="text-sm font-medium text-foreground">Enabled Modules</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DEFAULT_ENABLED_MODULES.map((moduleKey) => (
                <label key={moduleKey} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name={moduleKey} defaultChecked />
                  <span className="capitalize">{moduleKey}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <ConfirmSubmitButton
              label="Create Organization"
              confirmMessage="Create this organization with the selected owner, first bank account, and enabled modules?"
              className="px-4 py-2 bg-minia-primary text-white rounded-md text-sm font-medium"
            />
          </div>
        </form>
      </details>

      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Org List</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Organization</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Owner</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Modules</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {organizations.map((organization: any) => {
                const owner = organization.memberships?.[0]?.user || null;
                const enabledModules = Array.isArray(organization.enabledModules) ? organization.enabledModules : [];
                const isActiveOrg = ctx.activeOrganizationId === organization.id;

                return (
                  <tr key={organization.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{organization.name}</div>
                      <div className="text-xs text-muted-foreground">{organization.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div>{owner?.name || "-"}</div>
                      <div className="text-xs">{owner?.email || owner?.username || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <form action={updateOrganizationModules.bind(null, organization.id)} className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {DEFAULT_ENABLED_MODULES.map((moduleKey) => (
                            <label key={moduleKey} className="flex items-center gap-2 text-xs text-foreground">
                              <input type="checkbox" name={moduleKey} defaultChecked={enabledModules.includes(moduleKey)} />
                              <span className="capitalize">{moduleKey}</span>
                            </label>
                          ))}
                        </div>
                        <ConfirmSubmitButton
                          label="Update Modules"
                          confirmMessage={`Update enabled modules for ${organization.name}?`}
                          className="px-3 py-1.5 border border-input rounded-md text-xs font-medium"
                        />
                      </form>
                    </td>
                    <td className="px-6 py-4">
                      <span className={organization.isActive ? "text-minia-success" : "text-muted-foreground"}>
                        {organization.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <form action={loadOrganizationDemoData.bind(null, organization.id)}>
                          <ConfirmSubmitButton
                            label="Load Demo"
                            title="Load Demo Data"
                            confirmText="Load Demo"
                            type="info"
                            confirmMessage={`Load demo customers, items, invoices, payments, journals, inventory, and HR records for ${organization.name}? This only works when the org has no transactional data.`}
                            className="px-3 py-1.5 border border-blue-200 text-blue-700 rounded-md text-xs font-medium"
                          />
                        </form>
                        <form action={clearOrganizationTransactions.bind(null, organization.id)}>
                          <ConfirmSubmitButton
                            label="Clear Txns"
                            title="Clear Transactional Data"
                            confirmText="Clear Data"
                            type="danger"
                            confirmMessage={`Delete all transactional data for ${organization.name}? This keeps master data, settings, users, and chart of accounts, but removes invoices, payments, journals, inventory movements, and payroll transactions.`}
                            className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-md text-xs font-medium"
                          />
                        </form>
                        {organization.isActive ? (
                          <form action={switchOrganization.bind(null, organization.id)}>
                            <button className="px-3 py-1.5 bg-minia-primary text-white rounded-md text-xs font-medium">
                              {isActiveOrg ? "Switched" : "Switch"}
                            </button>
                          </form>
                        ) : null}
                        {isActiveOrg ? (
                          <form action={clearOrganizationSwitch}>
                            <button className="px-3 py-1.5 border border-input rounded-md text-xs font-medium">Back to Superadmin</button>
                          </form>
                        ) : null}
                        {organization.isActive ? (
                          <form action={disableOrganization.bind(null, organization.id)}>
                            <ConfirmSubmitButton
                              label="Disable"
                              confirmMessage={`Disable ${organization.name}? This will block access for that organization until you enable it again.`}
                              className="px-3 py-1.5 border border-red-200 text-red-600 rounded-md text-xs font-medium"
                            />
                          </form>
                        ) : (
                          <form action={enableOrganization.bind(null, organization.id)}>
                            <ConfirmSubmitButton
                              label="Enable"
                              confirmMessage={`Enable ${organization.name} again?`}
                              className="px-3 py-1.5 border border-minia-success/30 text-minia-success rounded-md text-xs font-medium"
                            />
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No organizations found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
