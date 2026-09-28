import { Database, Plus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { queries } from "@/lib/server/queries";
import { formatGb } from "@/lib/utils";

export const metadata: Metadata = { title: "Storage" };

export default async function StoragePage() {
  const [pools, volumes] = await Promise.all([queries.storagePools(), queries.volumes()]);
  const cap = pools.reduce((a, p) => a + p.capacityGb, 0);
  const used = pools.reduce((a, p) => a + p.usedGb, 0);
  const poolName = (id: string) => pools.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title="Storage" description="Local, ZFS, NFS, Ceph and S3-compatible storage pools." actions={<Button disabled title="Phase 2"><Plus /> Create Volume</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Capacity" value={formatGb(cap)} icon={Database} />
        <StatCard label="Used" value={formatGb(used)} sub={`${Math.round((used / cap) * 100)}%`}><Progress value={(used / cap) * 100} className="mt-3" /></StatCard>
        <StatCard label="Available" value={formatGb(cap - used)} />
      </div>
      <h2 className="mb-3 text-sm font-semibold">Storage Pools</h2>
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pools.map((p) => {
          const pct = (p.usedGb / p.capacityGb) * 100;
          return (
            <Card key={p.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono font-semibold">{p.name}</span>
                <Badge className="uppercase">{p.driver}</Badge>
              </div>
              <Progress value={pct} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{formatGb(p.usedGb)} used</span>
                <span>{formatGb(p.capacityGb - p.usedGb)} free</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">{p.content.map((c) => <Badge key={c} className="text-muted-foreground">{c}</Badge>)}</div>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle>Volumes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Name</th><th>Pool</th><th>Type</th><th>Size</th><th>Attached to</th></tr></thead>
            <tbody className="divide-y">
              {volumes.map((v) => (
                <tr key={v.id}>
                  <td className="py-2.5 font-mono">{v.name}</td>
                  <td className="font-mono text-xs">{poolName(v.poolId)}</td>
                  <td className="uppercase text-xs">{v.type}</td>
                  <td className="tabular-nums">{v.sizeGb} GB</td>
                  <td className="font-mono text-xs text-muted-foreground">{v.attachedTo ?? "— detached"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
