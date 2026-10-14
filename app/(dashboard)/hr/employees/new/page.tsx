import EmployeeForm from "../employee-form";
import { requirePageAccess } from "@/lib/rbac";

export default async function NewEmployeePage() {
  await requirePageAccess("hr.employees.create", "/hr/employees");
  return <EmployeeForm />;
}
