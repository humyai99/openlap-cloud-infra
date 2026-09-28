import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}

export function usageColor(v: number) {
  return v >= 85 ? "bg-red-500" : v >= 70 ? "bg-amber-500" : "bg-emerald-500";
}

export function Progress({ value, className, colorByValue = true }: { value: number; className?: string; colorByValue?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-all", colorByValue ? usageColor(v) : "bg-primary")} style={{ width: `${v}%` }} />
    </div>
  );
}
