"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toUserMessage } from "@/lib/errors";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error("DashboardError boundary:", error);
  }, [error]);

  const body = toUserMessage(error, "An unexpected error occurred in this page.");

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-muted/40">
      <div className="w-full max-w-xl bg-background border border-border shadow-xl rounded-xl p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{body}</p>
            {error?.digest ? (
              <p className="text-xs text-muted-foreground">
                Reference: <code className="bg-muted px-1 rounded">{error.digest}</code>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => {
              router.refresh();
              reset();
            }}
            className="inline-flex items-center px-4 py-2 rounded-md bg-minia-primary text-white text-sm font-medium hover:brightness-95"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
