"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { getPosCategoriesClient } from "../_actions_client";

interface Category {
  id: string;
  name: string;
}

interface CategoriesPaneProps {
  profileId: string;
  selectedCategory: string;
  onSelect: (catId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function CategoriesPane({
  profileId,
  selectedCategory,
  onSelect,
  collapsed,
  onToggleCollapse,
}: CategoriesPaneProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPosCategoriesClient(profileId)
      .then((data) => {
        if (active) {
          setCategories(data as Category[]);
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [profileId]);

  return (
    <div
      className={`h-full flex flex-col bg-muted/30 border-r transition-all duration-200 overflow-hidden ${
        collapsed ? "w-0 min-w-0 border-r-0" : "w-[10%] min-w-[120px]"
      }`}
    >
      {!collapsed && (
        <>
          <div className="flex items-center justify-between px-3 py-3 border-b border-border/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </span>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Hide categories"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            <button
              onClick={() => onSelect("all")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-minia-primary/20 text-minia-primary"
                  : "hover:bg-accent/60 text-foreground"
              }`}
            >
              <div className="truncate">All Items</div>
              <div className="text-[10px] opacity-70 font-normal">Everything</div>
            </button>

            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
            )}

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-minia-primary/20 text-minia-primary"
                    : "hover:bg-accent/60 text-foreground"
                }`}
              >
                <div className="truncate">{cat.name}</div>
              </button>
            ))}

            {!loading && categories.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No categories
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
