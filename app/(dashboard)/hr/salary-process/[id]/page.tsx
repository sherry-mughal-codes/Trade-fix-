import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";

export default async function SalarySlipViewPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageAccess("hr.salary.process", "/");

  const slip = await prisma.salarySlip.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { id: true, name: true } },
      journalEntry: { select: { id: true, entryNumber: true } },
    },
  });

  if (!slip) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Slip</h1>
          <p className="text-muted-foreground">Not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Slip</h1>
          <p className="text-muted-foreground">
            {String(slip.month).padStart(2, "0")}/{slip.year} · {slip.employee?.name}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/hr/salary-process"
            className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back
          </Link>
          {slip.status === "CANCELLED" && (
            <Link
              href={`/hr/salary-process/${slip.id}/edit`}
              className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-minia-primary/90"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium">{slip.status}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Journal Entry</div>
            <div className="font-medium">{slip.journalEntry?.entryNumber || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">CTC Amount</div>
            <div className="font-medium">{slip.ctcAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Payable Amount</div>
            <div className="font-medium">{slip.payableAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Absent Days</div>
            <div className="font-medium">{slip.absentDays.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Final Payable</div>
            <div className="font-medium">{slip.finalPayableAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Bonus</div>
            <div className="font-medium">{slip.bonus.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Deduction</div>
            <div className="font-medium">{slip.deduction.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{new Date(slip.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updated</div>
            <div className="font-medium">{new Date(slip.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
