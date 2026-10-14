import { requirePageAccess } from "@/lib/rbac";
import SalaryPaymentForm from "../salary-payment-form";

export default async function NewSalaryPaymentPage() {
  await requirePageAccess("hr.salary.payments", "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Record Salary Payment</h1>
        <p className="text-muted-foreground">Pay employee salary and record transaction</p>
      </div>
      <SalaryPaymentForm />
    </div>
  );
}
