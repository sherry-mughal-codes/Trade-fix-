import Link from "next/link";
import { Boxes, Building2, ClipboardList, Layers3, Ruler, Tags } from "lucide-react";
import { requireItemMasterAccess } from "../items/access";

export const dynamic = "force-dynamic";

export default async function MastersPage() {
  await requireItemMasterAccess();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          Core setup entities that support inventory, invoicing, and future stock workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Link
          href="/masters/units"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Ruler className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Units</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain the units that appear in the item master dropdown and conversion setup.
          </p>
        </Link>

        <Link
          href="/masters/categories"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Tags className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Item Categories</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain the categories available in item master for cleaner item classification.
          </p>
        </Link>

        <Link
          href="/masters/price-lists"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Tags className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Price Lists</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain standard selling/buying lists and customer/supplier-specific pricing.
          </p>
        </Link>

        <Link
          href="/masters/batches"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Layers3 className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Batches</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain the selectable batch list used in stock entry, adjustments, and purchase invoices.
          </p>
        </Link>

        <Link
          href="/masters/warehouses"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Warehouses</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain the warehouse dropdown values used in inventory workflows without warehouse-wise valuation logic.
          </p>
        </Link>

        <Link
          href="/items"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Item Master</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage default units, alternate units, inventory behavior, and the core item setup.
          </p>
        </Link>

        <Link
          href="/inventory"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Inventory</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open stock entry, adjustments, batch visibility, and the live inventory ledger.
          </p>
        </Link>
      </div>
    </div>
  );
}
