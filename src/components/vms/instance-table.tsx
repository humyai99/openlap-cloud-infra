"use client";
import { ArrowDown, ArrowUp, ArrowUpDown, Monitor, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, PageHeader } from "@/components/common";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { useInstances } from "@/lib/hooks";
import { osLabel } from "@/lib/mock/os";
import type { Instance, InstanceType, Node, Project, User } from "@/lib/types";
import { cn, formatDate, formatMemory, formatUptime } from "@/lib/utils";
import { InstanceActions } from "./instance-actions";

type SortKey = "name" | "status" | "node" | "cpuCores" | "memoryMb" | "diskGb" | "uptimeSeconds" | "createdAt";

export function InstanceTable({ type, nodes, projects, users }: { type: InstanceType; nodes: Node[]; projects: Project[]; users: User[] }) {
  const { data, error, loading, reload } = useInstances(type);
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState({ status: "", node: "", os: "", owner: "", project: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const isVm = type === "vm";
  const base = isVm ? "/vms" : "/containers";
  const noun = isVm ? "virtual machine" : "container";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data ?? []).filter(
      (i) =>
        (!needle || i.name.includes(needle) || i.ipv4?.includes(needle) || i.os.family.includes(needle)) &&
        (!f.status || i.status === f.status) &&
        (!f.node || i.nodeId === f.node) &&
        (!f.os || i.os.family === f.os) &&
        (!f.owner || i.ownerId === f.owner) &&
        (!f.project || i.projectId === f.project),
    );
    const val = (i: Instance): string | number => (sort.key === "node" ? nodeName(i.nodeId) : i[sort.key]);
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, f, sort]);

  const osOptions = [...new Set((data ?? []).map((i) => i.os.family))];
  const activeFilters = Object.values(f).filter(Boolean).length + (q ? 1 : 0);

  const th = (children: React.ReactNode, k?: SortKey, className?: string) => (
    <th key={String(k ?? children)} scope="col" className={cn("whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground", className)}
      aria-sort={k && sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      {k ? (
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
          {children}
          {sort.key === k ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
        </button>
      ) : children}
    </th>
  );

  return (
    <div>
      <PageHeader
        title={isVm ? "Virtual Machines" : "Containers"}
        description={isVm ? "KVM/QEMU virtual machines across all nodes." : "System containers (Incus/LXC) across all nodes."}
        actions={<Button asChild><Link href={isVm ? "/vms/new" : "/vms/new?type=container"}><Plus /> Create {isVm ? "VM" : "Container"}</Link></Button>}
      />

      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="relative xl:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, IP, OS…" aria-label="Search"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:flex">
          <Select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="xl:w-32">
            <option value="">All status</option>
            {["running", "stopped", "starting", "stopping", "error"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Select aria-label="Node" value={f.node} onChange={(e) => setF({ ...f, node: e.target.value })} className="xl:w-32">
            <option value="">All nodes</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </Select>
          <Select aria-label="OS" value={f.os} onChange={(e) => setF({ ...f, os: e.target.value })} className="xl:w-32">
            <option value="">All OS</option>
            {osOptions.map((o) => <option key={o} value={o}>{osLabel(o)}</option>)}
          </Select>
          <Select aria-label="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className="xl:w-32">
            <option value="">All owners</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select aria-label="Project" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} className="xl:w-36">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setF({ status: "", node: "", os: "", owner: "", project: "" }); router.replace(base); }}>
            <X /> Clear ({activeFilters})
          </Button>
        )}
        <span className="text-xs text-muted-foreground xl:ml-auto">{data ? `${rows.length} of ${data.length}` : ""}</span>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !loading && data?.length === 0 ? (
        <EmptyState icon={Monitor} title={`No ${noun}s yet`} description={`Create your first ${noun} to get started.`}
          action={<Button asChild><Link href={isVm ? "/vms/new" : "/vms/new?type=container"}><Plus /> Create {isVm ? "VM" : "Container"}</Link></Button>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {th("Name", "name")}{th("Status", "status")}{th("Node", "node")}{th("IP Address")}{th("OS")}
                {th("CPU", "cpuCores")}{th("Memory", "memoryMb")}{th("Disk", "diskGb")}{th("Uptime", "uptimeSeconds")}{th("Created", "createdAt")}
                {th(<span className="sr-only">Actions</span>, undefined, "text-right")}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 11 }).map((__, j) => <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                  ))
                : rows.length === 0
                  ? <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">No {noun}s match your filters.</td></tr>
                  : rows.map((i) => (
                      <tr key={i.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5"><Link href={`${base}/${i.id}`} className="font-mono font-medium hover:underline">{i.name}</Link></td>
                        <td className="px-3 py-2.5"><StatusBadge status={i.status} /></td>
                        <td className="px-3 py-2.5 font-mono text-xs">{nodeName(i.nodeId)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i.ipv4 ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{osLabel(i.os.family)} <span className="text-muted-foreground">{i.os.version}</span></td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {i.cpuCores} vCPU
                          {i.status === "running" && <span className="ml-1.5 text-xs text-muted-foreground">{i.cpuUsage}%</span>}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{formatMemory(i.memoryMb)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{i.diskGb} GB</td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatUptime(i.uptimeSeconds)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(i.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right"><InstanceActions inst={i} onChanged={reload} /></td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
