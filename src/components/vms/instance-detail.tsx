"use client";
import { Camera, ChevronDown, ChevronLeft, Loader2, Play, RotateCcw, RotateCw, Square, SquareTerminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog, EmptyState, ErrorState } from "@/components/common";
import { MetricChart, RangePicker } from "@/components/dashboard/metric-chart";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, Skeleton } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiClientError } from "@/lib/api/client";
import { runJob, usePowerAction } from "@/lib/hooks";
import { generateMetrics } from "@/lib/mock/data";
import { osLabel } from "@/lib/mock/os";
import type { AuditLog, Instance, Network, Node, Snapshot, StoragePool, TimeRange } from "@/lib/types";
import { formatDate, formatMemory, formatUptime, timeAgo } from "@/lib/utils";
import { ConsoleView } from "./console-view";
import { InstanceActions } from "./instance-actions";

const TABS = ["overview", "console", "hardware", "network", "storage", "snapshots", "backups", "monitoring", "logs"] as const;

function KV({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InstanceDetail({ id, nodes, networks, pools, logs }: { id: string; nodes: Node[]; networks: Network[]; pools: StoragePool[]; logs: AuditLog[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const [tab, setTab] = useState<string>(TABS.includes(tabParam as (typeof TABS)[number]) ? tabParam! : "overview");
  const [inst, setInst] = useState<Instance | null>(null);
  const [error, setError] = useState<{ msg: string; notFound: boolean } | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [range, setRange] = useState<TimeRange>("1h");
  const [edit, setEdit] = useState<{ cpu: number; mem: number } | null>(null);
  const [delSnap, setDelSnap] = useState<Snapshot | null>(null);
  const [restoreSnap, setRestoreSnap] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([api.getInstance(id), api.listSnapshots(id)]);
      setInst(i);
      setSnaps(s);
      setError(null);
    } catch (e) {
      setError({ msg: e instanceof Error ? e.message : "Failed to load", notFound: e instanceof ApiClientError && e.status === 404 });
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling
    void load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const power = usePowerAction(load);
  const seed = useMemo(() => [...id].reduce((a, c) => a + c.charCodeAt(0), 0), [id]);
  const metrics = useMemo(() => generateMetrics(range, seed, { cpu: inst?.cpuUsage || 3, memory: inst?.memoryUsage || 3, storage: 40 }), [range, seed, inst?.cpuUsage, inst?.memoryUsage]);

  if (error?.notFound) {
    return <EmptyState title="Instance not found" description="It may have been deleted." action={<Button asChild variant="outline"><Link href="/vms">Back to Virtual Machines</Link></Button>} />;
  }
  if (error && !inst) return <ErrorState message={error.msg} onRetry={load} />;
  if (!inst) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const node = nodes.find((n) => n.id === inst.nodeId);
  const net = networks.find((n) => n.id === inst.networkId);
  const pool = pools.find((p) => p.id === inst.storagePoolId);
  const running = inst.status === "running";
  const busy = inst.status === "starting" || inst.status === "stopping";
  const listHref = inst.type === "vm" ? "/vms" : "/containers";
  const instLogs = logs.filter((l) => l.resource.includes(inst.name));

  return (
    <div>
      <Link href={listHref} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> {inst.type === "vm" ? "Virtual Machines" : "Containers"}
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate font-mono text-xl font-semibold">{inst.name}</h1>
            <StatusBadge status={inst.status} className="rounded-md border px-2 py-0.5" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {osLabel(inst.os.family)} {inst.os.version} · {node?.name} · {inst.ipv4 ?? "no IP"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!running} onClick={() => setTab("console")}><SquareTerminal /> Console</Button>
          {running || busy ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => power(inst, "stop")}>{busy ? <Loader2 className="animate-spin" /> : <Square />} Stop</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => power(inst, "start")}><Play /> Start</Button>
          )}
          <Button variant="outline" size="sm" disabled={!running} onClick={() => power(inst, "restart")}><RotateCw /> Restart</Button>
          <InstanceActions inst={inst} onChanged={() => { void load(); }} trigger={<Button variant="outline" size="sm">More <ChevronDown /></Button>} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(t) => { setTab(t); router.replace(`?tab=${t}`, { scroll: false }); }}>
        <TabsList className="mb-6">
          {TABS.map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([["CPU", inst.cpuUsage, `${inst.cpuCores} vCPU`], ["Memory", inst.memoryUsage, formatMemory(inst.memoryMb)], ["Storage", 38, `${inst.diskGb} GB`]] as const).map(([l, v, sub]) => (
              <Card key={l} className="p-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{l}</span><span>{sub}</span></div>
                <div className="my-2 text-2xl font-semibold tabular-nums">{running ? `${v}%` : "—"}</div>
                <Progress value={running ? v : 0} />
              </Card>
            ))}
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Network</div>
              <div className="my-2 text-2xl font-semibold tabular-nums">{running ? `${Math.round(metrics.at(-1)?.netIn ?? 0)}` : "—"}<span className="text-sm text-muted-foreground"> Mbps in</span></div>
              <div className="text-xs text-muted-foreground">{net?.name}</div>
            </Card>
          </div>
          <KV items={[
            ["IP Address", <span key="ip" className="font-mono">{inst.ipv4 ?? "—"}</span>],
            ["MAC Address", <span key="mac" className="font-mono">{inst.macAddress}</span>],
            ["Node", node?.name ?? inst.nodeId],
            ["Uptime", formatUptime(inst.uptimeSeconds)],
            ["Provider", <span key="p" className={inst.provider === "mock" ? "text-amber-500" : ""}>{inst.provider}{inst.provider === "mock" ? " (simulated)" : ""}</span>],
            ["Storage Pool", pool?.name ?? "—"],
            ["Created", formatDate(inst.createdAt)],
            ["ID", <span key="id" className="font-mono text-xs">{inst.id}</span>],
          ]} />
        </TabsContent>

        <TabsContent value="console"><ConsoleView inst={inst} /></TabsContent>

        <TabsContent value="hardware">
          <Card>
            <CardHeader>
              <CardTitle>Hardware</CardTitle>
              {!edit ? (
                <Button size="sm" variant="outline" onClick={() => setEdit({ cpu: inst.cpuCores, mem: inst.memoryMb })}>Edit resources</Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => { const e = edit; setEdit(null); void runJob(() => api.resize(inst.id, e.cpu, e.mem), { loading: `Resizing ${inst.name}…`, success: "Resources updated" }, load); }}>Save</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr><td className="w-40 py-3 text-muted-foreground">CPU</td><td>{edit ? <Input type="number" min={1} className="w-28" value={edit.cpu} onChange={(e) => setEdit({ ...edit, cpu: Number(e.target.value) })} aria-label="CPU cores" /> : `${inst.cpuCores} vCPU (host-passthrough)`}</td></tr>
                  <tr><td className="py-3 text-muted-foreground">Memory</td><td>{edit ? <Input type="number" min={256} step={256} className="w-28" value={edit.mem} onChange={(e) => setEdit({ ...edit, mem: Number(e.target.value) })} aria-label="Memory MB" /> : formatMemory(inst.memoryMb)}</td></tr>
                  <tr><td className="py-3 text-muted-foreground">Disk 0</td><td>{inst.diskGb} GB · virtio-scsi · {pool?.name}</td></tr>
                  <tr><td className="py-3 text-muted-foreground">NIC 0</td><td className="font-mono text-xs">virtio · {inst.macAddress} · {net?.bridge}{net?.vlanId ? ` tag=${net.vlanId}` : ""}</td></tr>
                  {inst.type === "vm" && <tr><td className="py-3 text-muted-foreground">Firmware</td><td>OVMF (UEFI) · q35</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network">
          <KV items={[["Network", net?.name ?? "—"], ["Type", net?.type ?? "—"], ["Subnet", net?.cidr ?? "—"], ["Gateway", net?.gateway ?? "—"], ["VLAN", net?.vlanId ?? "untagged"], ["Bridge", net?.bridge ?? "—"], ["IPv4", inst.ipv4 ?? "—"], ["DNS", net?.dns.join(", ") || "—"]]} />
        </TabsContent>

        <TabsContent value="storage">
          <KV items={[["Pool", pool?.name ?? "—"], ["Driver", pool?.driver.toUpperCase() ?? "—"], ["Disk size", `${inst.diskGb} GB`], ["Bus", "virtio-scsi"]]} />
        </TabsContent>

        <TabsContent value="snapshots">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot Timeline</CardTitle>
              <Button size="sm" onClick={() => void runJob(() => api.createSnapshot(inst.id, `snap-${Date.now().toString(36)}`), { loading: "Creating snapshot…", success: "Snapshot created" }, load)}>
                <Camera /> Create Snapshot
              </Button>
            </CardHeader>
            <CardContent>
              {!snaps?.length ? (
                <EmptyState icon={Camera} title="No snapshots" description="Snapshots capture disk (and optionally memory) state for quick rollback." />
              ) : (
                <ol className="relative ml-2 border-l pl-6">
                  {snaps.map((s) => (
                    <li key={s.id} className="relative mb-6 last:mb-0">
                      <span className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-card bg-foreground/60" />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {formatDate(s.createdAt)} · {timeAgo(s.createdAt)} · {s.sizeGb} GB{s.includesMemory ? " · incl. RAM" : ""}{s.description ? ` · ${s.description}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRestoreSnap(s)}><RotateCcw /> Restore</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDelSnap(s)} aria-label={`Delete ${s.name}`}><Trash2 /></Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <ConfirmDialog open={!!delSnap} onOpenChange={(o) => !o && setDelSnap(null)} title={`Delete snapshot "${delSnap?.name}"?`}
            onConfirm={() => { const s = delSnap; if (s) void runJob(() => api.deleteSnapshot(inst.id, s.id), { loading: `Deleting snapshot ${s.name}…`, success: "Snapshot deleted" }, load); }} />
          <ConfirmDialog open={!!restoreSnap} onOpenChange={(o) => !o && setRestoreSnap(null)} title={`Restore "${restoreSnap?.name}"?`} confirmLabel="Restore"
            description="The instance will be rolled back to this snapshot. Changes made after it was taken will be lost."
            onConfirm={() => { const s = restoreSnap; if (s) void runJob(() => api.restoreSnapshot(inst.id, s.id), { loading: `Restoring ${s.name}…`, success: "Snapshot restored" }, load); }} />
        </TabsContent>

        <TabsContent value="backups">
          <EmptyState title="No backups configured" description="Schedule daily, weekly or monthly backups to Local, NFS or S3 targets. (Phase 2)" />
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader><CardTitle>Performance</CardTitle><RangePicker value={range} onChange={setRange} /></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div><p className="mb-2 text-xs text-muted-foreground">CPU</p><MetricChart data={metrics} range={range} series={[{ key: "cpu", label: "CPU", color: "#3b82f6" }]} /></div>
              <div><p className="mb-2 text-xs text-muted-foreground">Memory</p><MetricChart data={metrics} range={range} series={[{ key: "memory", label: "Memory", color: "#a855f7" }]} /></div>
              <div className="md:col-span-2"><p className="mb-2 text-xs text-muted-foreground">Network</p><MetricChart data={metrics} range={range} unit="Mbps" series={[{ key: "netIn", label: "In", color: "#10b981" }, { key: "netOut", label: "Out", color: "#f59e0b" }]} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          {instLogs.length === 0 ? (
            <EmptyState title="No events yet" description="Actions on this instance will appear here." />
          ) : (
            <div className="rounded-xl border bg-card font-mono text-xs">
              {instLogs.map((l) => (
                <div key={l.id} className="flex gap-4 border-b px-4 py-2 last:border-0">
                  <span className="text-muted-foreground" suppressHydrationWarning>{new Date(l.timestamp).toLocaleString("en-GB")}</span>
                  <span className={l.result === "success" ? "text-emerald-500" : "text-red-500"}>{l.result.toUpperCase()}</span>
                  <span>{l.user}: {l.action}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
