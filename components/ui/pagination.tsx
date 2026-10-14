"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
}: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
      <div className="flex-1 flex justify-between sm:hidden">
        <Link
          href={createPageURL(currentPage - 1)}
          className={cn(
            "relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-md text-foreground bg-background hover:bg-accent",
            currentPage <= 1 && "pointer-events-none opacity-50"
          )}
        >
          Previous
        </Link>
        <Link
          href={createPageURL(currentPage + 1)}
          className={cn(
            "ml-3 relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-md text-foreground bg-background hover:bg-accent",
            currentPage >= totalPages && "pointer-events-none opacity-50"
          )}
        >
          Next
        </Link>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</span> to{" "}
            <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
            <span className="font-medium text-foreground">{totalCount}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <Link
              href={createPageURL(currentPage - 1)}
              className={cn(
                "relative inline-flex items-center px-2 py-2 rounded-l-md border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-accent",
                currentPage <= 1 && "pointer-events-none opacity-50"
              )}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            
            {pages.map((pageNum) => (
                <Link
                    key={pageNum}
                    href={createPageURL(pageNum)}
                    className={cn(
                        "relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                        currentPage === pageNum
                            ? "z-10 bg-minia-primary border-minia-primary text-white"
                            : "bg-background border-input text-muted-foreground hover:bg-accent"
                    )}
                >
                    {pageNum}
                </Link>
            ))}

            <Link
              href={createPageURL(currentPage + 1)}
              className={cn(
                "relative inline-flex items-center px-2 py-2 rounded-r-md border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-accent",
                currentPage >= totalPages && "pointer-events-none opacity-50"
              )}
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
