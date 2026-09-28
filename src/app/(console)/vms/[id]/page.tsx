import { Suspense } from "react";
import { InstanceDetail } from "@/components/vms/instance-detail";
import { queries } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function InstanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [nodes, networks, pools, logs] = await Promise.all([queries.nodes(), queries.networks(), queries.storagePools(), queries.auditLogs(300)]);
  return (
    <Suspense>
      <InstanceDetail id={id} nodes={nodes} networks={networks} pools={pools} logs={logs} />
    </Suspense>
  );
}
