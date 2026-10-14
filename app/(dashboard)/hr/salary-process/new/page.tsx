import { requirePageAccess } from "@/lib/rbac";
import SalaryProcessForm from "../salary-process-form";

export default async function NewSalaryProcessPage() {
  await requirePageAccess("hr.salary.process", "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Process Salary</h1>
        <p className="text-muted-foreground">Calculate and generate monthly salary slips</p>
      </div>
      <SalaryProcessForm />
    </div>
  );
}
