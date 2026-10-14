import { prisma } from "@/lib/prisma";
import EmployeeForm from "../../employee-form";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/rbac";

export default async function EditEmployeePage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageAccess("hr.employees.action.edit", "/hr/employees");
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
  });

  if (!employee) {
    notFound();
  }

  return <EmployeeForm initialData={employee} />;
}
