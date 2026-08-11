import type { HTMLAttributes, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const featuredSurfaceClass =
  "rounded-[28px] border border-stone-200/80 bg-white shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]";

const warmMetricCardClass =
  "rounded-3xl border border-stone-200/80 bg-white p-4 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]";

const warmSectionCardClass =
  "overflow-hidden rounded-3xl border-warm/20 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.24)] dark:border-warm/25 dark:shadow-[0_24px_60px_-48px_rgba(0,0,0,0.6)]";

const warmSectionHeaderClass =
  "border-b border-warm/12 bg-linear-to-r from-warm-soft/80 via-background to-background dark:border-warm/15 dark:from-warm/12 dark:via-card dark:to-card";

const warmSectionTitleClass = "text-warm-strong dark:text-warm";

const warmTableSurfaceClass =
  "overflow-x-auto rounded-[28px] border border-warm/18 bg-white shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-warm/22 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]";

export function FeaturedSurface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn(featuredSurfaceClass, className)} {...props} />;
}

export function FeaturedPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(featuredSurfaceClass, className)} {...props} />;
}

export function WarmIconChip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("rounded-full bg-warm-soft p-2 text-warm dark:bg-warm/18 dark:text-warm", className)}
      {...props}
    />
  );
}

export function WarmMetricLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-warm", className)}
      {...props}
    />
  );
}

export function WarmMetricValue({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-2 text-3xl font-bold tracking-tight text-warm-strong dark:text-warm", className)}
      {...props}
    />
  );
}

export function WarmTitleText({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <span className={cn(warmSectionTitleClass, className)} {...props} />;
}

export function WarmMetricCard({
  label,
  value,
  description,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  description: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(warmMetricCardClass, className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <WarmMetricLabel>{label}</WarmMetricLabel>
          <WarmMetricValue>{value}</WarmMetricValue>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <WarmIconChip>{icon}</WarmIconChip>
      </div>
    </div>
  );
}

export function WarmSectionHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className={cn("text-sm font-semibold tracking-tight", warmSectionTitleClass)}>{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function WarmSectionCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn(warmSectionCardClass, className)}>
      <CardHeader className={warmSectionHeaderClass}>
        <CardTitle className={warmSectionTitleClass}>{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function WarmSurfaceCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(warmSectionCardClass, className)} {...props} />;
}

export function WarmTableSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(warmTableSurfaceClass, className)} {...props} />;
}

export function WarmTableHead({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return <TableHead className={cn("text-warm", className)} {...props} />;
}