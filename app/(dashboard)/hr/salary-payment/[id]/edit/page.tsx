import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import EditSalaryPaymentForm from "./edit-salary-payment-form";

export default async function EditSalaryPaymentPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageAccess("hr.salary.payments", "/");

  const payment = await prisma.salaryPayment.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { name: true } },
    },
  });

  if (!payment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Salary Payment</h1>
          <p className="text-muted-foreground">Not found</p>
        </div>
      </div>
    );
  }

  if (payment.status !== "CANCELLED") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Salary Payment</h1>
            <p className="text-muted-foreground">Only CANCELLED payments can be edited</p>
          </div>
          <Link
            href="/hr/salary-payment"
            className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Salary Payment</h1>
          <p className="text-muted-foreground">{payment.paymentNumber}</p>
        </div>
        <Link
          href="/hr/salary-payment"
          className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back
        </Link>
      </div>

      <EditSalaryPaymentForm
        payment={JSON.parse(
          JSON.stringify({
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            status: payment.status,
            date: payment.date,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            fromAccountId: payment.fromAccountId,
            reference: payment.reference,
            employee: payment.employee,
          })
        )}
      />
    </div>
  );
}
