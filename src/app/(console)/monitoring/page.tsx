import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { MonitoringView } from "@/components/dashboard/monitoring-view";
import { queries } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Monitoring" };
export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const [nodes, alerts] = await Promise.all([queries.nodes(), queries.alerts()]);
  const me = await requireUser();
  const running = (await queries.instances(me)).filter((i) => i.status === "running");
  return (
    <>
      <PageHeader title="Performance" description="Prometheus metrics (simulated) across nodes and instances." />
      <MonitoringView nodes={nodes} alerts={alerts} instances={running} />
    </>
  );
}
