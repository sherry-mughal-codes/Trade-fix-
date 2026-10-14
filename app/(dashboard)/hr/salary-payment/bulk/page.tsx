import { requirePageAccess } from "@/lib/rbac";
import BulkSalaryPaymentForm from "./bulk-salary-payment-form";

export default async function BulkSalaryPaymentPage() {
  await requirePageAccess("hr.salary.payments", "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Salary Payment</h1>
        <p className="text-muted-foreground">
          Pay salary to multiple employees in a single workflow
        </p>
      </div>
      <BulkSalaryPaymentForm />
    </div>
  );
}
