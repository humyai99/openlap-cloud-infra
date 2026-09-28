import { cn } from "@/lib/utils";
import type { InstanceStatus, NodeStatus } from "@/lib/types";

export function Badge({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", className)} {...p} />;
}

const STATUS: Record<InstanceStatus | NodeStatus, { label: string; dot: string; text: string; pulse?: boolean }> = {
  running: { label: "Running", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  stopped: { label: "Stopped", dot: "bg-slate-400", text: "text-muted-foreground" },
  starting: { label: "Starting", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", pulse: true },
  stopping: { label: "Stopping", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", pulse: true },
  maintenance: { label: "Maintenance", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  offline: { label: "Offline", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

export function StatusBadge({ status, className }: { status: InstanceStatus | NodeStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.text, className)}>
      <span className={cn("size-2 rounded-full", s.dot, s.pulse && "animate-pulse")} aria-hidden />
      {s.label}
    </span>
  );
}
