import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import Pagination from "@/components/ui/pagination";
import { requirePageAccess } from "@/lib/rbac";
import SalaryPaymentActions from "./salary-payment-actions";

const FILTER_FIELDS: FilterField[] = [
  { name: "paymentNumber", label: "Payment #", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "employeeName", label: "Employee", type: "text" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Posted", value: "POSTED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    name: "paymentMethod",
    label: "Method",
    type: "select",
    options: [
      { label: "Cash", value: "Cash" },
      { label: "Bank Transfer", value: "Bank Transfer" },
      { label: "Cheque", value: "Cheque" },
      { label: "Credit Card", value: "Credit Card" },
    ],
  },
  { name: "fromAccountName", label: "From Account", type: "text" },
  { name: "amount", label: "Amount", type: "number" },
  { name: "reference", label: "Reference", type: "text" },
];

export default async function SalaryPaymentPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
  };
}) {
  await requirePageAccess("hr.salary.payments", "/");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = {
    OR: [
      { paymentNumber: { contains: query } },
      { reference: { contains: query } },
      { employee: { name: { contains: query } } },
      { fromAccount: { name: { contains: query } } },
    ],
  };

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

            if (field === "fromAccountName") {
              return { fromAccount: { name: wrapOperator("name", value).name } };
            }

            if (field === "date") {
              const date = new Date(value);
              if (!Number.isFinite(date.getTime())) return {};
              const start = new Date(date);
              start.setHours(0, 0, 0, 0);
              const end = new Date(date);
              end.setHours(23, 59, 59, 999);
              return { date: { gte: start, lte: end } };
            }

            if (field === "amount") {
              return wrapOperator("amount", Number(value));
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

  const [salaryPayments, totalCount] = await Promise.all([
    prisma.salaryPayment.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true, code: true } },
        journalEntry: { select: { entryNumber: true } },
      },
      take: limit,
      skip,
    }),
    prisma.salaryPayment.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Salary Payments</h1>
          <p className="text-sm text-muted-foreground">
            View previous salary payments and record new payments
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/hr/salary-payment/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Salary Payment
          </Link>
          <Link
            href="/hr/salary-payment/bulk"
            className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Bulk Salary Payment
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search salary payments..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Payment #</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground">Employee</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground whitespace-nowrap">Method</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground">From Account</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                <th className="px-3.5 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="px-3.5 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {salaryPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3.5 py-8 text-center text-muted-foreground">
                    No salary payments found
                  </td>
                </tr>
              ) : (
                salaryPayments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-3.5 py-3 font-medium text-minia-primary whitespace-nowrap">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-3 text-foreground font-medium max-w-[140px] truncate" title={payment.employee?.name || "Unknown"}>
                      {payment.employee?.name || "Unknown"}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          payment.status === "POSTED"
                            ? "bg-minia-success/10 text-minia-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">{payment.paymentMethod}</td>
                    <td className="px-3.5 py-3 text-muted-foreground max-w-[150px] truncate" title={`${payment.fromAccount?.code ? `${payment.fromAccount.code} - ` : ""}${payment.fromAccount?.name || ""}`}>
                      {payment.fromAccount?.code ? `${payment.fromAccount.code} - ` : ""}
                      {payment.fromAccount?.name || ""}
                    </td>
                    <td className="px-3.5 py-3 text-right font-medium text-foreground whitespace-nowrap">
                      {payment.amount.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground max-w-[110px] truncate" title={payment.reference || ""}>{payment.reference || ""}</td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <SalaryPaymentActions
                        payment={JSON.parse(
                          JSON.stringify({
                            id: payment.id,
                            status: payment.status,
                            paymentNumber: payment.paymentNumber,
                            date: payment.date,
                            amount: payment.amount,
                            paymentMethod: payment.paymentMethod,
                            reference: payment.reference,
                            employee: payment.employee,
                            fromAccount: payment.fromAccount,
                            journalEntry: payment.journalEntry,
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
