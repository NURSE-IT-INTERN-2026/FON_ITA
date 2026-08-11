import type { HTMLAttributes, ReactNode } from "react";
import {
  featuredSurfaceClass,
  warmIconChipClass,
  warmMetricCardClass,
  warmMetricEyebrowClass,
  warmMetricValueClass,
  warmSectionCardClass,
  warmSectionHeaderClass,
  warmSectionTitleClass,
} from "@/components/shell/surface-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FeaturedSurface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn(featuredSurfaceClass, className)} {...props} />;
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
          <p className={warmMetricEyebrowClass}>{label}</p>
          <p className={warmMetricValueClass}>{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className={warmIconChipClass}>{icon}</span>
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