"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchPosItemsClient } from "../_actions_client";

interface POSItem {
  id: string;
  name: string;
  itemCode: string;
  unitName: string;
  stockQty: number;
  unitPrice: number;
}

interface ItemGridProps {
  profileId: string;
  categoryId: string;
  query: string;
  onAddToCart: (item: POSItem) => void;
}

export default function ItemGrid({ profileId, categoryId, query, onAddToCart }: ItemGridProps) {
  const [items, setItems] = useState<POSItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const catId = categoryId === "all" ? null : categoryId;
    fetchPosItemsClient({ posProfileId: profileId, categoryId: catId, query })
      .then((data) => {
        if (active) setItems(data as POSItem[]);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [profileId, categoryId, query]);

  const getStockBadge = (qty: number) => {
    if (qty >= 10) return "bg-green-600";
    if (qty >= 1) return "bg-amber-500";
    return "bg-red-600";
  };

  const fmtPrice = (n: number) => `Rs ${n.toFixed(2)}`;

  return (
    <div className="h-full overflow-y-auto p-3">
      {loading ? (
        <div className="flex items-center justify-center h-full py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading items...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center h-full py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
              <Loader2 className="h-8 w-8" />
            </div>
            <p className="font-medium text-foreground">No items found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different category or search term
            </p>
          </div>
        </div>
      ) : (
        <div
          className="grid gap-3 p-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {items.map((item) => {
            const outOfStock = item.stockQty <= 0;
            return (
              <button
                key={item.id}
                onClick={() => !outOfStock && onAddToCart(item)}
                disabled={outOfStock}
                className={`relative text-left rounded-lg border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden ${
                  outOfStock
                    ? "cursor-not-allowed opacity-60 grayscale"
                    : "hover:-translate-y-0.5 hover:border-minia-primary/40 active:scale-[0.98]"
                }`}
              >
                <div
                  className={`absolute top-2 right-2 rounded-full bg-opacity-90 px-2 py-0.5 text-[10px] font-semibold text-white ${getStockBadge(
                    item.stockQty
                  )}`}
                >
                  {item.stockQty}
                </div>

                <div className="p-3 pt-8">
                  <div className="text-sm font-semibold text-foreground line-clamp-2 min-h-[40px] leading-tight">
                    {item.name}
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-base font-bold text-minia-primary">
                      {fmtPrice(item.unitPrice)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.unitName || "unit"}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
