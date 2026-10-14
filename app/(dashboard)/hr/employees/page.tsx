import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Mail, Phone, Calendar } from "lucide-react";
import SearchInput from "@/components/ui/search";
import Pagination from "@/components/ui/pagination";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

import EmployeeRowActions from "./employee-row-actions";

const FILTER_FIELDS: FilterField[] = [
  { name: "name", label: "Name", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Inactive", value: "INACTIVE" },
    ],
  },
  { name: "ctc", label: "CTC", type: "number" },
];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
  };
}) {
  await requirePageAccess("hr.employees.list", "/");
  const organizationId = await requireOrganizationId();
  const canCreate = await hasPermission("hr.employees.create");
  const canEdit = await hasPermission("hr.employees.action.edit");
  const canDelete = await hasPermission("hr.employees.action.delete");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    OR: [{ name: { contains: query } }, { email: { contains: query } }, { phone: { contains: query } }],
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
    } catch (error) {
      console.error("Failed to parse filters", error);
    }
  }

  const [employees, totalCount] = await Promise.all([
    prisma.employee.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      take: limit,
      skip,
    }),
    prisma.employee.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your employee records</p>
        </div>
        {canCreate ? (
          <Link
            href="/hr/employees/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Link>
        ) : null}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <SearchInput placeholder="Search employees..." />
        </div>
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Contact</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Join Date</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">CTC</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-minia-primary">{employee.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        {employee.email ? (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" />
                            {employee.email}
                          </div>
                        ) : null}
                        {employee.phone ? (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" />
                            {employee.phone}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-3 w-3" />
                        {new Date(employee.joinDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{employee.ctc.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          employee.status === "ACTIVE"
                            ? "bg-minia-success/10 text-minia-success"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <EmployeeRowActions
                        id={employee.id}
                        editUrl={canEdit ? `/hr/employees/${employee.id}/edit` : undefined}
                        canDelete={canDelete}
                        viewData={JSON.parse(JSON.stringify(employee))}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount} pageSize={limit} />
      </div>
    </div>
  );
}
