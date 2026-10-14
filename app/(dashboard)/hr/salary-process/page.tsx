import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import { requirePageAccess } from "@/lib/rbac";
import SalarySlipActions from "./salary-slip-actions";

const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  return {
    label: new Date(2000, i, 1).toLocaleString("default", { month: "long" }),
    value: String(month),
  };
});

const FILTER_FIELDS: FilterField[] = [
  { name: "employeeName", label: "Employee", type: "text" },
  { name: "month", label: "Month", type: "select", options: monthOptions },
  { name: "year", label: "Year", type: "number" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Posted", value: "POSTED" },
      { label: "Cancelled", value: "CANCELLED" },
      { label: "Draft", value: "DRAFT" },
    ],
  },
  { name: "finalPayableAmount", label: "Final Payable", type: "number" },
  { name: "createdAt", label: "Created", type: "date" },
];

export default async function SalaryProcessPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
  };
}) {
  await requirePageAccess("hr.salary.process", "/");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = {
    OR: [{ employee: { name: { contains: query } } }, { status: { contains: query } }],
  };

  const numericQuery = Number(query);
  if (query && Number.isFinite(numericQuery)) {
    if (numericQuery >= 1 && numericQuery <= 12) {
      whereClause.OR.push({ month: numericQuery });
    }
    if (numericQuery >= 1900 && numericQuery <= 2100) {
      whereClause.OR.push({ year: numericQuery });
    }
  }

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(
        Buffer.from(searchParams.filters, "base64").toString("utf8")
      );

      if (Array.isArray(filters) && filters.length > 0) {
        const filterConditions = filters
          .map((filter: any) => {
            const { field, operator, value } = filter;

            const wrapOperator = (fieldName: string, rawValue: any) => {
              switch (operator) {
                case "contains":
                  return { [fieldName]: { contains: rawValue } };
                case "equals":
                  return { [fieldName]: { equals: rawValue } };
                case "startsWith":
                  return { [fieldName]: { startsWith: rawValue } };
                case "endsWith":
                  return { [fieldName]: { endsWith: rawValue } };
                case "not":
                  return { [fieldName]: { not: rawValue } };
                case "gt":
                  return { [fieldName]: { gt: Number(rawValue) } };
                case "lt":
                  return { [fieldName]: { lt: Number(rawValue) } };
                case "gte":
                  return { [fieldName]: { gte: Number(rawValue) } };
                case "lte":
                  return { [fieldName]: { lte: Number(rawValue) } };
                default:
                  return {};
              }
            };

            if (field === "employeeName") {
              return { employee: { name: wrapOperator("name", value).name } };
            }

            if (field === "month") {
              return wrapOperator("month", Number(value));
            }

            if (field === "year") {
              return wrapOperator("year", Number(value));
            }

            if (field === "createdAt") {
              const date = new Date(value);
              if (!Number.isFinite(date.getTime())) return {};
              const start = new Date(date);
              start.setHours(0, 0, 0, 0);
              const end = new Date(date);
              end.setHours(23, 59, 59, 999);
              return { createdAt: { gte: start, lte: end } };
            }

            if (field === "finalPayableAmount") {
              return wrapOperator("finalPayableAmount", Number(value));
            }

            return wrapOperator(field, value);
          })
          .filter((condition: any) => Object.keys(condition).length > 0);

        if (filterConditions.length > 0) {
          whereClause = {
            AND: [whereClause, ...filterConditions],
          };
        }
      }
    } catch (error) {
      console.error("Failed to parse filters", error);
    }
  }

  const [salarySlips, totalCount] = await Promise.all([
    prisma.salarySlip.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, name: true } },
        journalEntry: { select: { entryNumber: true } },
      },
      take: limit,
      skip,
    }),
    prisma.salarySlip.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Processed Salaries</h1>
          <p className="text-sm text-muted-foreground">
            View processed salary slips and run a new salary process
          </p>
        </div>
        <Link
          href="/hr/salary-process/new"
          className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Process Salary
        </Link>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search salary slips..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Month/Year</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground">Employee</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Payable</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Absent</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Bonus</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Deduction</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Created</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {salarySlips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3.5 py-8 text-center text-muted-foreground">
                    No processed salary slips found
                  </td>
                </tr>
              ) : (
                salarySlips.map((slip) => (
                  <tr key={slip.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-3.5 py-3 font-medium text-foreground whitespace-nowrap">
                      {String(slip.month).padStart(2, "0")}/{slip.year}
                    </td>
                    <td className="px-3.5 py-3 text-foreground max-w-[180px] truncate" title={slip.employee?.name || "Unknown"}>
                      {slip.employee?.name || "Unknown"}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          slip.status === "POSTED"
                            ? "bg-minia-success/10 text-minia-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {slip.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-medium text-foreground whitespace-nowrap">
                      {slip.finalPayableAmount.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {slip.absentDays.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {slip.bonus.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {slip.deduction.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(slip.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <SalarySlipActions
                        slip={JSON.parse(
                          JSON.stringify({
                            id: slip.id,
                            status: slip.status,
                            month: slip.month,
                            year: slip.year,
                            employee: slip.employee,
                            createdAt: slip.createdAt,
                            updatedAt: slip.updatedAt,
                            ctcAmount: slip.ctcAmount,
                            payableAmount: slip.payableAmount,
                            absentDays: slip.absentDays,
                            bonus: slip.bonus,
                            deduction: slip.deduction,
                            finalPayableAmount: slip.finalPayableAmount,
                            journalEntry: slip.journalEntry,
                          })
                        )}
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
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={limit}
        />
      </div>
    </div>
  );
}
