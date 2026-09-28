import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { CreateWizard } from "@/components/vms/create-wizard";
import { quotaUsage } from "@/lib/server/instances";
import { requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Create Instance" };
export const dynamic = "force-dynamic";

export default async function NewVmPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const [nodes, projects, pools, networks] = await Promise.all([queries.nodes(), queries.projects(await requireUser()), queries.storagePools(), queries.networks()]);
  const quotas = Object.fromEntries(await Promise.all(projects.map(async (p) => [p.id, await quotaUsage(p.id)] as const)));
  const isCt = type === "container";
  return (
    <>
      <PageHeader title={isCt ? "Create Container" : "Create Virtual Machine"} description="Configure resources, then review and provision." />
      <CreateWizard initialType={isCt ? "container" : "vm"} nodes={nodes} projects={projects} pools={pools} networks={networks} quotas={quotas} />
    </>
  );
}
