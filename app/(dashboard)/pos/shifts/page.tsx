import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requirePOSAccess } from "../access";

export const dynamic = "force-dynamic";

export default async function POSShiftsPage() {
  await requirePOSAccess();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pos" className="rounded-full p-2 transition-colors hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shifts</h1>
          <p className="text-sm text-muted-foreground">Track cashier shifts, openings, and closings.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 shadow-sm">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-minia-primary/10 text-minia-primary">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Coming Soon</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Shift management is under development. Open shifts, count float, close, and reconcile registers here.
          </p>
        </div>
      </div>
    </div>
  );
}
