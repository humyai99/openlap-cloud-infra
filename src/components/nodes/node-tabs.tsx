"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common";
import { MetricChart, RangePicker } from "@/components/dashboard/metric-chart";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateMetrics } from "@/lib/mock/data";
import type { Instance, Node, StoragePool, TimeRange } from "@/lib/types";
import { formatGb, formatMemory } from "@/lib/utils";

function InstanceList({ items }: { items: Instance[] }) {
  if (!items.length) return <EmptyState title="Nothing running here" />;
  return (
    <div className="divide-y rounded-xl border bg-card">
      {items.map((i) => (
        <Link key={i.id} href={`/${i.type === "vm" ? "vms" : "containers"}/${i.id}`} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/30">
          <span className="font-mono text-sm">{i.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{i.cpuCores} vCPU · {formatMemory(i.memoryMb)}</span>
          <StatusBadge status={i.status} />
        </Link>
      ))}
    </div>
  );
}

export function NodeTabs({ node, instances, pools }: { node: Node; instances: Instance[]; pools: StoragePool[] }) {
  const [range, setRange] = useState<TimeRange>("24h");
  const metrics = useMemo(() => generateMetrics(range, node.name.length * 11, { cpu: node.cpuUsage, memory: node.memoryUsage, storage: node.storageUsage }), [range, node]);
  const tabs = ["overview", "virtual machines", "containers", "storage", "network", "hardware", "monitoring", "logs"];

  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-6">{tabs.map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList>
      <TabsContent value="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([["CPU", node.cpuUsage, `${node.cpuCores} cores`], ["Memory", node.memoryUsage, `${node.memoryGb} GB`], ["Storage", node.storageUsage, `${node.storageTb} TB`]] as const).map(([l, v, s]) => (
          <Card key={l} className="p-4">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{l}</span><span>{s}</span></div>
            <div className="my-2 text-2xl font-semibold tabular-nums">{v}%</div>
            <Progress value={v} />
          </Card>
        ))}
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Guests</div>
          <div className="my-2 text-2xl font-semibold">{instances.length}</div>
          <div className="text-xs text-muted-foreground">{instances.filter((i) => i.type === "vm").length} VMs · {instances.filter((i) => i.type === "container").length} containers</div>
        </Card>
      </TabsContent>
      <TabsContent value="virtual machines"><InstanceList items={instances.filter((i) => i.type === "vm")} /></TabsContent>
      <TabsContent value="containers"><InstanceList items={instances.filter((i) => i.type === "container")} /></TabsContent>
      <TabsContent value="storage" className="grid gap-3 md:grid-cols-2">
        {pools.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="mb-2 flex justify-between text-sm"><span className="font-mono font-medium">{p.name}</span><span className="text-xs uppercase text-muted-foreground">{p.driver}</span></div>
            <Progress value={(p.usedGb / p.capacityGb) * 100} />
            <p className="mt-2 text-xs text-muted-foreground">{formatGb(p.usedGb)} / {formatGb(p.capacityGb)}</p>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="network">
        <Card><CardContent className="pt-5 font-mono text-xs leading-6">
          <p>vmbr0  bridge  {node.address}/24  up  (eno1)</p>
          <p>vmbr1  bridge  NAT 172.16.50.1/24  up</p>
          <p>vmbr2  bridge  VLAN-aware  (eno2)  up</p>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="hardware">
        <Card><CardContent className="grid gap-4 pt-5 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">CPU</p><p>{node.cpuModel} · {node.cpuCores} cores</p></div>
          <div><p className="text-xs text-muted-foreground">Memory</p><p>{node.memoryGb} GB ECC</p></div>
          <div><p className="text-xs text-muted-foreground">Kernel</p><p className="font-mono">{node.kernel}</p></div>
          <div><p className="text-xs text-muted-foreground">Provider</p><p className="text-amber-500">{node.provider} (simulated)</p></div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="monitoring">
        <Card>
          <CardHeader><CardTitle>Node metrics</CardTitle><RangePicker value={range} onChange={setRange} /></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <MetricChart data={metrics} range={range} series={[{ key: "cpu", label: "CPU", color: "#3b82f6" }, { key: "memory", label: "Memory", color: "#a855f7" }]} />
            <MetricChart data={metrics} range={range} unit="Mbps" series={[{ key: "netIn", label: "In", color: "#10b981" }, { key: "netOut", label: "Out", color: "#f59e0b" }]} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="logs"><EmptyState title="Node logs stream from journald in Phase 3" /></TabsContent>
    </Tabs>
  );
}
