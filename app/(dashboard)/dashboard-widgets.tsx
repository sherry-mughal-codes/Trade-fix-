import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, CircleAlert, ShieldAlert, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AgeingBucket, DashboardStat, DashboardTableRow, LinkCount, QueueItem, Tone } from "./dashboard-mock-data";

const toneClasses: Record<Tone, string> = {
  primary: "border-minia-primary/20 bg-minia-primary/5 text-minia-primary",
  success: "border-minia-success/20 bg-minia-success/5 text-minia-success",
  warning: "border-minia-warning/20 bg-minia-warning/5 text-minia-warning",
  danger: "border-minia-danger/20 bg-minia-danger/5 text-minia-danger",
  neutral: "border-border bg-accent/40 text-foreground",
};

export function Surface({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
          <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function StatCard({ stat }: { stat: DashboardStat }) {
  return (
    <Link
      href={stat.href}
      className="group flex h-full w-full flex-col justify-between rounded-2xl border border-border bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-md"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground truncate" title={stat.label}>
            {stat.label}
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {stat.value}
        </div>
        {stat.delta ? (
          <div className="mt-2">
            <span className={`inline-flex max-w-full items-center truncate rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${toneClasses[stat.tone]}`}>
              {stat.delta}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 border-t border-border/40 pt-2.5">
        <p className="text-xs text-muted-foreground line-clamp-2">{stat.caption}</p>
      </div>
    </Link>
  );
}

export function QueueColumn({
  title,
  icon,
  items,
}: {
  title: string;
  icon: "urgent" | "due" | "review";
  items: QueueItem[];
}) {
  const Icon = icon === "urgent" ? ShieldAlert : icon === "due" ? Clock3 : TrendingUp;

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:bg-accent/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[item.tone]}`}>
                {item.dueLabel}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AlertList({
  items,
}: {
  items: Array<{ id: string; title: string; count: number; description: string; tone: Tone; href: string }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-accent/40">
          <div className="flex min-w-0 gap-3">
            <div className={`mt-0.5 rounded-lg border p-2 ${toneClasses[item.tone]}`}>
              <CircleAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
            </div>
          </div>
          <div className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${toneClasses[item.tone]}`}>{item.count}</div>
        </Link>
      ))}
    </div>
  );
}

export function CountGrid({ items }: { items: LinkCount[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-accent/40">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="text-lg font-semibold text-foreground">{item.value}</div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[item.tone]}`}>{item.tone}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CompactRows({ rows }: { rows: DashboardTableRow[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <Link key={row.id} href={row.href} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-3 transition-colors hover:bg-accent/40">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{row.primary}</div>
            <div className="mt-1 text-xs text-muted-foreground">{row.secondary}</div>
            {row.meta ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {row.meta === "Payroll + payments"
                  ? "Operational follow-ups"
                  : row.meta === "Monitoring payroll + receivables"
                    ? "Monitoring team workload"
                    : row.meta}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {row.tertiary ? <div className="text-xs font-medium text-foreground">{row.tertiary}</div> : null}
            {row.tone ? <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[row.tone]}`}>{row.tone}</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AgeingBars({ items }: { items: AgeingBucket[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.amount}</span>
          </div>
          <div className="h-2 rounded-full bg-accent/60">
            <div className="h-2 rounded-full bg-foreground/80" style={{ width: `${item.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToneList({
  customers,
}: {
  customers: Array<{ id: string; customer: string; riskScore: number; issues: string[]; receivableAmount: string; nextAction: string; href: string }>;
}) {
  return (
    <div className="space-y-3">
      {customers.map((item) => {
        const tone: Tone = item.riskScore >= 85 ? "danger" : item.riskScore >= 75 ? "warning" : "primary";
        return (
          <Link key={item.id} href={item.href} className="block rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-accent/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">{item.customer}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.issues.join(" • ")}</div>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}>
                Risk {item.riskScore}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{item.nextAction}</span>
              <span className="font-medium text-foreground">{item.receivableAmount}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function SalesTrendChart({
  items,
  currency = "PKR",
}: {
  items: Array<{ label: string; value: number }>;
  currency?: string;
}) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => formatter.format(Number(value)).replace(/\.00$/, "")}
          />
          <Tooltip
            formatter={(value) => formatter.format(Number(value ?? 0))}
            cursor={{ fill: "hsl(var(--accent) / 0.35)" }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
            }}
          />
          <Bar dataKey="value" name="Sales" fill="hsl(var(--minia-primary))" radius={[8, 8, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
