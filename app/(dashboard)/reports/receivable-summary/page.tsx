import { requirePageAccess } from "@/lib/rbac";
import ReceivableSummaryClient from "./receivable-summary-client";

export default async function ReceivableSummaryPage() {
  await requirePageAccess("reports.receivableSummary", "/reports");
  return <ReceivableSummaryClient />;
}
