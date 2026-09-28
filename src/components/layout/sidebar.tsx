"use client";
import { Boxes } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Progress } from "@/components/ui/misc";
import type { Node } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

export function SidebarContent({ nodes, onNavigate }: { nodes: Node[]; onNavigate?: () => void }) {
  const avg = (key: "cpuUsage" | "memoryUsage" | "storageUsage") => (nodes.length ? Math.round(nodes.reduce((a, n) => a + n[key], 0) / nodes.length) : 0);
  const pathname = usePathname();
  const net = nodes.reduce((a, n) => a + n.networkMbps, 0);
  const stats = [
    { label: "CPU", value: avg("cpuUsage") },
    { label: "RAM", value: avg("memoryUsage") },
    { label: "Storage", value: avg("storageUsage") },
  ];

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4" onClick={onNavigate}>
        <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">OpenLab Cloud</div>
          <div className="text-[10px] text-muted-foreground">Build. Run. Experiment.</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {NAV.map((group, gi) => (
          <div key={gi} className="mb-3">
            {group.label && <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</div>}
            <ul>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        active && "bg-accent font-medium text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {!item.ready && <span className="ml-auto text-[9px] uppercase text-muted-foreground/50">soon</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-4">
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-medium">Server Status</span>
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500" /> {nodes.filter((n) => n.status === "online").length}/{nodes.length} online
          </span>
        </div>
        <div className="space-y-2.5">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{s.label}</span>
                <span className="tabular-nums">{s.value}%</span>
              </div>
              <Progress value={s.value} />
            </div>
          ))}
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Network</span>
            <span className="tabular-nums">{(net / 1000).toFixed(2)} Gbps</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ nodes }: { nodes: Node[] }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
      <SidebarContent nodes={nodes} />
    </aside>
  );
}
