import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export default async function InvoiceDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageAccess("invoices.list", "/invoices");
  const organizationId = await requireOrganizationId();

  const [invoice, companySettings] = await Promise.all([
    prisma.invoice.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
      include: {
        party: true,
        items: true,
        payments: true,
      },
    }),
    prisma.companySettings.findFirst({
      where: { organizationId },
      select: { baseCurrency: true },
    }),
  ]);

  if (!invoice) {
    notFound();
  }

  const canEdit = invoice.status === "DRAFT";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Invoice Details</p>
          <h1 className="text-2xl font-semibold text-foreground">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.type} invoice for {invoice.party?.name || "Unknown party"}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/invoices"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back
          </Link>
          {canEdit ? (
            <Link
              href={`/invoices/${invoice.id}/edit`}
              className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
            >
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grand Total</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {invoice.currency} {Number(invoice.grandTotal || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="mt-2 text-xl font-semibold text-minia-success">
            {invoice.currency} {Number(invoice.paidAmount || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="mt-2 text-xl font-semibold text-minia-danger">
            {invoice.currency} {Number(invoice.balanceAmount || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Base Total</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {(companySettings?.baseCurrency || "Base")} {Number(invoice.baseGrandTotal || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Invoice Info</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{invoice.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium text-foreground">{invoice.type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium text-foreground">{new Date(invoice.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium text-foreground">
                {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium text-foreground">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Exchange Rate</p>
              <p className="font-medium text-foreground">{Number(invoice.exchangeRate || 1).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Party Info</h2>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{invoice.party?.name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium text-foreground">{invoice.party?.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{invoice.party?.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Address</p>
              <p className="font-medium text-foreground">{invoice.party?.address || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Discount</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                    No items found
                  </td>
                </tr>
              ) : (
                invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 text-foreground">
                      <div>{item.description}</div>
                      {item.batchNumber || item.expiryDate || item.warehouseName ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.batchNumber ? `Batch: ${item.batchNumber}` : ""}
                          {item.batchNumber && (item.expiryDate || item.warehouseName) ? " • " : ""}
                          {item.expiryDate ? `Expiry: ${new Date(item.expiryDate).toLocaleDateString()}` : ""}
                          {item.expiryDate && item.warehouseName ? " • " : ""}
                          {item.warehouseName ? `Warehouse: ${item.warehouseName}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground">{Number(item.quantity || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-foreground">{Number(item.unitPrice || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-foreground">{Number(item.discount || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">{Number(item.amount || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
