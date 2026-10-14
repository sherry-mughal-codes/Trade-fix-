import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RowActions from "@/components/ui/row-actions";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requirePOSProfileAccess } from "../access";
import { deletePOSProfile } from "../actions";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "Profile", type: "text" },
  { name: "code", label: "Code", type: "text" },
  {
    name: "isActive",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
];

export default async function POSProfilesPage({
  searchParams,
}: {
  searchParams?: { query?: string; filters?: string; page?: string; limit?: string };
}) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    name: { contains: query },
  });

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        whereClause = {
          AND: [
            whereClause,
            ...filters.map((filter: any) => {
              const value = filter.field === "isActive" ? filter.value === "true" : filter.value;
              const op = filter.operator === "contains" ? "contains" : "equals";
              return { [filter.field]: { [op]: value } };
            }),
          ],
        };
      }
    } catch (error) {
      console.error("Failed to parse profile filters", error);
    }
  }

  const [profiles, totalCount] = await Promise.all([
    prisma.pOSProfile.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      take: limit,
      skip,
      include: {
        posCounter: { select: { name: true } },
        defaultUser: { select: { name: true, email: true } },
        walkinCustomer: { select: { name: true } },
      },
    }),
    prisma.pOSProfile.count({ where: whereClause }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">POS Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Configure cashier profiles: defaults, permissions, counter links, and receipt settings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            POS Home
          </Link>
          <Link
            href="/pos/profiles/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Profile
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search profiles..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Profile</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Counter</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Walk-in Customer</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Default Cashier</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No POS profiles found.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{profile.name}</div>
                          {profile.code ? (
                            <div className="mt-1 text-xs text-muted-foreground">{profile.code}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {profile.posCounter?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {profile.walkinCustomer?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {profile.defaultUser?.name || profile.defaultUser?.email || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          profile.isActive
                            ? "bg-minia-success/10 text-minia-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {profile.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowActions
                        id={profile.id}
                        editUrl={`/pos/profiles/${profile.id}/edit`}
                        onDelete={deletePOSProfile.bind(null, profile.id)}
                        type="posProfile"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / limit)}
          totalCount={totalCount}
          pageSize={limit}
        />
      </div>
    </div>
  );
}
