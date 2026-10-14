import { requirePageAccess } from "@/lib/rbac";
import CashFlowStatementClient from "./cash-flow-statement-client";

export default async function CashFlowStatementPage() {
  await requirePageAccess("reports.generalLedger", "/reports");

  return <CashFlowStatementClient />;
}
