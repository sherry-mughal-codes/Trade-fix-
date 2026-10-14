"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    // no-op: keeps component client-only so onClick runs on client
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you requested does not exist or you may have used an old link.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md bg-minia-primary text-white text-sm font-medium hover:brightness-95"
          >
            Go to dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.history.back();
              }
            }}
            className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}


