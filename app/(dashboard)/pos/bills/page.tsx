import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requirePOSAccess } from "../access";

export const dynamic = "force-dynamic";

export default async function POSBillsPage() {
  await requirePOSAccess();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pos" className="rounded-full p-2 transition-colors hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">POS Bills</h1>
          <p className="text-sm text-muted-foreground">View and search POS bill history.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 shadow-sm">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-minia-primary/10 text-minia-primary">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Coming Soon</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The POS bills listing is under development. Check back soon for bill history, search, and reprint options.
          </p>
        </div>
      </div>
    </div>
  );
}
