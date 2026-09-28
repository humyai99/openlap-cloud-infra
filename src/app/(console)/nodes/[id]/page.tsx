import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NodeTabs } from "@/components/nodes/node-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { queries } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const node = await queries.node((await params).id);
  if (!node) notFound();
  const instances = await queries.instances(await requireUser(), { nodeId: node.id });
  const pools = (await queries.storagePools()).filter((p) => p.nodeId === node.id || p.nodeId === null);
  return (
    <div>
      <Link href="/nodes" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Nodes</Link>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{node.name}</h1>
        <StatusBadge status={node.status} className="rounded-md border px-2 py-0.5" />
      </div>
      <NodeTabs node={node} instances={instances} pools={pools} />
    </div>
  );
}
