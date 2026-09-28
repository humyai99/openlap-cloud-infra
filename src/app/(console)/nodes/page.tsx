import { Cpu, HardDrive, MemoryStick, Plus, Server } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { queries } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Nodes" };
export const dynamic = "force-dynamic";

export default async function NodesPage() {
  const nodes = await queries.nodes();
  const instances = await queries.instances(await requireUser());
  return (
    <>
      <PageHeader title="Nodes" description="Physical hypervisor hosts in cluster main." actions={<Button disabled title="Node enrollment arrives in Phase 3"><Plus /> Add Node</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nodes.map((n) => {
          const vms = instances.filter((i) => i.nodeId === n.id && i.type === "vm").length;
          const cts = instances.filter((i) => i.nodeId === n.id && i.type === "container").length;
          return (
            <Link key={n.id} href={`/nodes/${n.id}`}>
              <Card className="p-5 transition-colors hover:bg-accent/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2"><Server className="size-5" /></div>
                    <div>
                      <p className="font-mono font-semibold">{n.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{n.address}</p>
                    </div>
                  </div>
                  <StatusBadge status={n.status} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <div><Cpu className="mb-1 size-4 text-muted-foreground" /><p className="font-medium">{n.cpuCores} Cores</p><p className="truncate text-muted-foreground">{n.cpuModel}</p></div>
                  <div><MemoryStick className="mb-1 size-4 text-muted-foreground" /><p className="font-medium">{n.memoryGb} GB</p><p className="text-muted-foreground">RAM</p></div>
                  <div><HardDrive className="mb-1 size-4 text-muted-foreground" /><p className="font-medium">{n.storageTb} TB</p><p className="text-muted-foreground">Storage</p></div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {([["CPU", n.cpuUsage], ["RAM", n.memoryUsage], ["Storage", n.storageUsage]] as const).map(([l, v]) => (
                    <div key={l}>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{l}</span><span className="tabular-nums">{v}%</span></div>
                      <Progress value={v} />
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-between border-t pt-4 text-xs text-muted-foreground">
                  <span><b className="text-foreground">{vms}</b> VMs</span>
                  <span><b className="text-foreground">{cts}</b> Containers</span>
                  <span><b className="text-foreground">{n.networkMbps}</b> Mbps</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
