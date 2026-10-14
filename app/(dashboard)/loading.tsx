export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-80 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-10 w-10 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          <div className="h-9 w-72 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-muted animate-pulse" />
          <div className="h-4 w-10/12 rounded bg-muted animate-pulse" />
          <div className="h-4 w-9/12 rounded bg-muted animate-pulse" />
        </div>
      </div>

      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          Loading…
        </div>
      </div>
    </div>
  );
}

