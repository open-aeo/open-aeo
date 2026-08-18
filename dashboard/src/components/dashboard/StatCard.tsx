import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  loading,
  chart,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Point change against the previous period, in the value's own units. */
  delta?: { value: number; suffix?: string; goodWhen?: "up" | "down" } | null;
  icon?: ReactNode;
  loading?: boolean;
  chart?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>

      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="tabular text-2xl leading-none font-semibold tracking-tight">
            {value}
          </span>
          {delta != null && <DeltaPill {...delta} />}
        </div>
      )}

      {chart && <div className="h-9">{chart}</div>}
      {hint && !loading && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

function DeltaPill({
  value,
  suffix = "",
  goodWhen = "up",
}: {
  value: number;
  suffix?: string;
  goodWhen?: "up" | "down";
}) {
  const flat = Math.abs(value) < 0.0001;
  const up = value > 0;
  const good = goodWhen === "up" ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "tabular mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium",
        flat ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "0" : `${up ? "+" : ""}${Math.round(value * 10) / 10}`}
      {suffix}
    </span>
  );
}
