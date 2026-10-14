import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import RowActions from "@/components/ui/row-actions";
import SearchInput from "@/components/ui/search";
import DynamicFilter, { FilterField } from "@/components/ui/dynamic-filter";
import { deletePayment } from "./actions";
import Pagination from "@/components/ui/pagination";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

const FILTER_FIELDS: FilterField[] = [
  { name: "paymentNumber", label: "Payment #", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "type", label: "Type", type: "select", options: [
    { label: "Receive", value: "RECEIVE" },
    { label: "Pay", value: "PAY" }
  ]},
  { name: "method", label: "Method", type: "select", options: [
    { label: "Cash", value: "Cash" },
    { label: "Bank Transfer", value: "Bank Transfer" },
    { label: "Cheque", value: "Cheque" },
    { label: "Credit Card", value: "Credit Card" },
  ]},
  { name: "amount", label: "Amount", type: "number" },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
  };
}) {
  await requirePageAccess("payments.list", "/");
  const organizationId = await requireOrganizationId();
  const canCreate = await hasPermission("payments.create");
  const canEdit = await hasPermission("payments.action.edit");
  const canDelete = await hasPermission("payments.action.delete");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;
  
  // Parse dynamic filters
  let whereClause: any = withOrganization(organizationId, {
    OR: [
      { paymentNumber: { contains: query } },
      { reference: { contains: query } },
      { party: { name: { contains: query } } },
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
          AND: [
            whereClause,
            ...filterConditions
          ]
        };
      }
    } catch (e) {
      console.error("Failed to parse filters", e);
    }
  }

  const [payments, totalCount, accounts] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { party: true },
      take: limit,
      skip: skip,
    }),
    prisma.payment.count({ where: whereClause }),
    prisma.account.findMany({
        where: { organizationId, type: "ASSET" },
        include: { parent: true },
        orderBy: { name: 'asc' }
    })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Track all received and sent payments</p>
        </div>
        {canCreate ? (
          <Link 
              href="/payments/new" 
              className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
          >
              <Plus className="h-4 w-4 mr-2" />
              Create Payment
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
        <SearchInput placeholder="Search payments..." />
        <DynamicFilter fields={FILTER_FIELDS} />
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                    <tr>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Payment #</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Date</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Party</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Method</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground text-right">Amount</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {payments.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                No payments found
                            </td>
                        </tr>
                    ) : (
                        payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-accent/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-minia-primary">
                                    {payment.paymentNumber}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {new Date(payment.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-foreground">
                                    {payment.party?.name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                        payment.type === 'RECEIVE' 
                                            ? 'bg-minia-success/10 text-minia-success' 
                                            : 'bg-minia-danger/10 text-minia-danger'
                                    }`}>
                                        {payment.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {payment.method}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-foreground">
                                    {payment.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                        <RowActions 
                                            id={payment.id}
                                            viewData={JSON.parse(JSON.stringify(payment))}
                                            editUrl={canEdit ? `/payments/${payment.id}/edit` : undefined}
                                            onDelete={canDelete ? deletePayment.bind(null, payment.id) : undefined}
                                            type="payment"
                                            accounts={accounts}
                                        />
                                    </td>
                                </tr>
                            ))
                    )}
                </tbody>
            </table>
        </div>
        
        {/* Pagination */}
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
