import type { Metadata } from "next";
import { Suspense } from "react";
import { InstanceTable } from "@/components/vms/instance-table";
import { requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Virtual Machines" };

export default async function VmsPage() {
  const [nodes, projects, users] = await Promise.all([queries.nodes(), queries.projects(await requireUser()), queries.users()]);
  return (
    <Suspense>
      <InstanceTable type="vm" nodes={nodes} projects={projects} users={users} />
    </Suspense>
  );
}
