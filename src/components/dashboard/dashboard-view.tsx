"use client";
import { Activity, AlertTriangle, Boxes, CheckCircle2, Cpu, Disc, HardDrive, MemoryStick, Monitor, Plus, Server, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MockNotice, StatCard } from "@/components/common";
import { MetricChart, RangePicker } from "@/components/dashboard/metric-chart";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Skeleton } from "@/components/ui/misc";
import { useInstances } from "@/lib/hooks";
import { generateMetrics } from "@/lib/mock/data";
import type { Alert, AuditLog, HealthState, Node, TimeRange } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function nodeHealth(n: Node): HealthState {
  if (n.status !== "online") return "critical";
  const peak = Math.max(n.cpuUsage, n.memoryUsage, n.storageUsage);
  return peak >= 90 ? "critical" : peak >= 80 ? "warning" : "healthy";
}

const HEALTH = {
  healthy: { label: "Healthy", icon: CheckCircle2, cls: "text-emerald-500" },
  warning: { label: "Warning", icon: AlertTriangle, cls: "text-amber-500" },
  critical: { label: "Critical", icon: XCircle, cls: "text-red-500" },
} as const;

export function DashboardView({ userName, nodes, alerts, activity }: { userName: string; nodes: Node[]; alerts: Alert[]; activity: AuditLog[] }) {
  const { data: instances } = useInstances();
  const [range, setRange] = useState<TimeRange>("24h");
  const metrics = useMemo(() => generateMetrics(range), [range]);
  const [hour] = useState(() => new Date().getHours());

  const vms = instances?.filter((i) => i.type === "vm") ?? [];
  const cts = instances?.filter((i) => i.type === "container") ?? [];
  const count = (list: typeof vms, s: string) => list.filter((i) => i.status === s).length;
  const avg = (k: "cpuUsage" | "memoryUsage" | "storageUsage") => (nodes.length ? Math.round(nodes.reduce((a, n) => a + n[k], 0) / nodes.length) : 0);

  const instanceHealth: Record<HealthState, number> = { healthy: 0, warning: 0, critical: 0 };
  for (const i of instances ?? []) {
    if (i.status === "error") instanceHealth.critical++;
    else if (i.status === "running" && (i.cpuUsage > 80 || i.memoryUsage > 85)) instanceHealth.warning++;
    else instanceHealth.healthy++;
  }
  for (const a of alerts) if (a.severity === "critical") instanceHealth.critical++;

  const topCpu = [...(instances ?? [])].filter((i) => i.status === "running").sort((a, b) => b.cpuUsage - a.cpuUsage).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" suppressHydrationWarning>{greeting(hour)}, {userName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your infrastructure.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href="/vms/new"><Plus /> Create VM</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/vms/new?type=container"><Boxes /> Create Container</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/iso"><Disc /> Upload ISO</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/nodes"><Server /> Add Node</Link></Button>
        </div>
      </div>

      <MockNotice />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Virtual Machines" icon={Monitor} value={instances ? vms.length : <Skeleton className="h-8 w-12" />}
          sub={<><span className="text-emerald-500">{count(vms, "running")} Running</span> / {count(vms, "stopped")} Stopped</>} />
        <StatCard label="Containers" icon={Boxes} value={instances ? cts.length : <Skeleton className="h-8 w-12" />}
          sub={<><span className="text-emerald-500">{count(cts, "running")} Running</span> / {count(cts, "stopped")} Stopped</>} />
        <StatCard label="Nodes" icon={Server} value={nodes.length}
          sub={<><span className="text-emerald-500">{nodes.filter((n) => n.status === "online").length} Online</span> / {nodes.filter((n) => n.status !== "online").length} Offline</>} />
        {([["CPU Usage", "cpuUsage", Cpu], ["Memory", "memoryUsage", MemoryStick], ["Storage", "storageUsage", HardDrive]] as const).map(([label, k, Icon]) => (
          <StatCard key={k} label={label} icon={Icon} value={`${avg(k)}%`}>
            <Progress value={avg(k)} className="mt-3" />
          </StatCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>Cluster-wide, all nodes</CardDescription>
            </div>
            <RangePicker value={range} onChange={setRange} />
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">CPU Usage</p>
              <MetricChart data={metrics} range={range} series={[{ key: "cpu", label: "CPU", color: "#3b82f6" }]} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Memory Usage</p>
              <MetricChart data={metrics} range={range} series={[{ key: "memory", label: "Memory", color: "#a855f7" }]} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Network Traffic</p>
              <MetricChart data={metrics} range={range} unit="Mbps" series={[{ key: "netIn", label: "Inbound", color: "#10b981" }, { key: "netOut", label: "Outbound", color: "#f59e0b" }]} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Storage Usage</p>
              <MetricChart data={metrics} range={range} series={[{ key: "storage", label: "Storage", color: "#64748b" }]} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Infrastructure Health</CardTitle>
                <CardDescription>Instances and alerts</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {(Object.keys(HEALTH) as HealthState[]).map((h) => {
                const H = HEALTH[h];
                return (
                  <div key={h} className="rounded-lg border p-3 text-center">
                    <H.icon className={cn("mx-auto size-5", H.cls)} />
                    <div className="mt-1.5 text-lg font-semibold tabular-nums">{instances ? instanceHealth[h] : "–"}</div>
                    <div className="text-[11px] text-muted-foreground">{H.label}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Node Health</CardTitle>
              <Link href="/nodes" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {nodes.map((n) => {
                const h = HEALTH[nodeHealth(n)];
                return (
                  <Link key={n.id} href={`/nodes/${n.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent/50">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{n.name}</span>
                      <span className={cn("flex items-center gap-1 text-xs", h.cls)}><h.icon className="size-3.5" /> {h.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                      {([["CPU", n.cpuUsage], ["RAM", n.memoryUsage], ["Disk", n.storageUsage]] as const).map(([l, v]) => (
                        <div key={l}>
                          <div className="mb-1 flex justify-between"><span>{l}</span><span className="tabular-nums">{v}%</span></div>
                          <Progress value={v} />
                        </div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>VM Status</CardTitle><Link href="/vms" className="text-xs text-muted-foreground hover:text-foreground">View all</Link></CardHeader>
          <CardContent className="space-y-2">
            {!instances
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : vms.slice(0, 6).map((vm) => (
                  <Link key={vm.id} href={`/vms/${vm.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50">
                    <span className="truncate font-mono text-sm">{vm.name}</span>
                    <StatusBadge status={vm.status} />
                  </Link>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top CPU Consumers</CardTitle><Activity className="size-4 text-muted-foreground" /></CardHeader>
          <CardContent className="space-y-3">
            {!instances
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
              : topCpu.map((i) => (
                  <div key={i.id}>
                    <div className="mb-1 flex justify-between text-xs"><span className="truncate font-mono">{i.name}</span><span className="tabular-nums text-muted-foreground">{i.cpuUsage}%</span></div>
                    <Progress value={i.cpuUsage} />
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle><Link href="/audit-logs" className="text-xs text-muted-foreground hover:text-foreground">Audit log</Link></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {activity.length === 0 && <li className="text-sm text-muted-foreground">No recent activity</li>}
              {activity.slice(0, 6).map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.result === "success" ? "bg-emerald-500" : "bg-red-500")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate"><span className="font-medium">{a.user}</span> <span className="text-muted-foreground">{a.action.toLowerCase()}</span> <span className="font-mono text-xs">{a.resource}</span></p>
                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>{timeAgo(a.timestamp)} · {a.ipAddress}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
