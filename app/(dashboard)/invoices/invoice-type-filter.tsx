"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InvoiceTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") || "SALE";

  const handleFilter = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentType === type) {
      params.set("type", "ALL");
    } else {
      params.set("type", type);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const isSalesActive = currentType === "SALE";
  const isPurchaseActive = currentType === "PURCHASE";
  const isPosActive = currentType === "POS";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={isSalesActive ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilter("SALE")}
        className={cn(
          isSalesActive && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
          "transition-all"
        )}
      >
        Sales
      </Button>
      <Button
        variant={isPosActive ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilter("POS")}
        className={cn(
          isPosActive && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
          "transition-all"
        )}
      >
        POS
      </Button>
      <Button
        variant={isPurchaseActive ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilter("PURCHASE")}
        className={cn(
          isPurchaseActive && "bg-orange-600 hover:bg-orange-700 text-white border-orange-600",
          "transition-all"
        )}
      >
        Purchases
      </Button>
    </div>
  );
}
