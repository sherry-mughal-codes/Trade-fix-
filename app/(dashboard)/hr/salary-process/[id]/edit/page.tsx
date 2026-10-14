import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import EditSalarySlipForm from "./edit-salary-slip-form";

export default async function EditSalarySlipPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageAccess("hr.salary.process", "/");

  const slip = await prisma.salarySlip.findUnique({
    where: { id: params.id },
    include: { employee: { select: { name: true } } },
  });

  if (!slip) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Salary Slip</h1>
          <p className="text-muted-foreground">Not found</p>
        </div>
      </div>
    );
  }

  if (slip.status !== "CANCELLED") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Salary Slip</h1>
            <p className="text-muted-foreground">Only CANCELLED slips can be edited</p>
          </div>
          <Link
            href={`/hr/salary-process/${slip.id}`}
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
          <h1 className="text-2xl font-bold tracking-tight">Edit Salary Slip</h1>
          <p className="text-muted-foreground">
            {String(slip.month).padStart(2, "0")}/{slip.year} · {slip.employee?.name}
          </p>
        </div>
        <Link
          href={`/hr/salary-process/${slip.id}`}
          className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back
        </Link>
      </div>

      <EditSalarySlipForm
        slip={JSON.parse(
          JSON.stringify({
            id: slip.id,
            month: slip.month,
            year: slip.year,
            status: slip.status,
            employee: slip.employee,
            ctcAmount: slip.ctcAmount,
            absentDays: slip.absentDays,
            payableAmount: slip.payableAmount,
            bonus: slip.bonus,
            deduction: slip.deduction,
            finalPayableAmount: slip.finalPayableAmount,
          })
        )}
      />
    </div>
  );
}
