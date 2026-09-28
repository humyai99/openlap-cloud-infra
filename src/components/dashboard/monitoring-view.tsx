"use client";
import { AlertTriangle, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { MetricChart, RangePicker } from "@/components/dashboard/metric-chart";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { generateMetrics } from "@/lib/mock/data";
import type { Alert, Instance, Node, TimeRange } from "@/lib/types";
import { formatMemory, timeAgo } from "@/lib/utils";

export function MonitoringView({ nodes, alerts, instances }: { nodes: Node[]; alerts: Alert[]; instances: Instance[] }) {
  const [range, setRange] = useState<TimeRange>("6h");
  const m = useMemo(() => generateMetrics(range, 3), [range]);
  const iops = useMemo(() => m.map((p) => ({ ...p, cpu: p.netIn * 4.2, memory: p.netOut * 3.1 })), [m]);
  const topCpu = [...instances].sort((a, b) => b.cpuUsage - a.cpuUsage).slice(0, 6);
  const topMem = [...instances].sort((a, b) => b.memoryUsage * b.memoryMb - a.memoryUsage * a.memoryMb).slice(0, 6);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Alerts</CardTitle><span className="text-xs text-muted-foreground">{alerts.length} active</span></CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              {a.severity === "critical" ? <XCircle className="size-4 text-red-500" /> : <AlertTriangle className="size-4 text-amber-500" />}
              <span className="font-mono">{a.resource}</span>
              <span className="text-muted-foreground">{a.message}</span>
              <span className="ml-auto text-xs text-muted-foreground" suppressHydrationWarning>{timeAgo(a.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Infrastructure Overview</CardTitle><RangePicker value={range} onChange={setRange} /></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div><p className="mb-2 text-xs text-muted-foreground">CPU / RAM</p><MetricChart data={m} range={range} series={[{ key: "cpu", label: "CPU", color: "#3b82f6" }, { key: "memory", label: "RAM", color: "#a855f7" }]} /></div>
          <div><p className="mb-2 text-xs text-muted-foreground">Network Throughput</p><MetricChart data={m} range={range} unit="Mbps" series={[{ key: "netIn", label: "In", color: "#10b981" }, { key: "netOut", label: "Out", color: "#f59e0b" }]} /></div>
          <div><p className="mb-2 text-xs text-muted-foreground">Disk IOPS (read / write)</p><MetricChart data={iops} range={range} unit="IOPS" series={[{ key: "cpu", label: "Read", color: "#06b6d4" }, { key: "memory", label: "Write", color: "#ec4899" }]} /></div>
          <div><p className="mb-2 text-xs text-muted-foreground">Storage Usage</p><MetricChart data={m} range={range} series={[{ key: "storage", label: "Storage", color: "#64748b" }]} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Top CPU Consumers</CardTitle></CardHeader>
          <CardContent className="space-y-3">{topCpu.map((i) => (
            <div key={i.id}><div className="mb-1 flex justify-between text-xs"><span className="font-mono">{i.name}</span><span className="tabular-nums">{i.cpuUsage}%</span></div><Progress value={i.cpuUsage} /></div>
          ))}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Memory Consumers</CardTitle></CardHeader>
          <CardContent className="space-y-3">{topMem.map((i) => (
            <div key={i.id}><div className="mb-1 flex justify-between text-xs"><span className="font-mono">{i.name}</span><span className="tabular-nums">{formatMemory(Math.round((i.memoryMb * i.memoryUsage) / 100))}</span></div><Progress value={i.memoryUsage} /></div>
          ))}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Node Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">{nodes.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="font-mono text-sm">{n.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">CPU {n.cpuUsage}% · RAM {n.memoryUsage}%</span>
              <StatusBadge status={n.status} />
            </div>
          ))}</CardContent>
        </Card>
      </div>
    </div>
  );
}
