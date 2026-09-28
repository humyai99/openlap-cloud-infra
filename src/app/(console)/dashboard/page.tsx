import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { hasPermission, requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await requireUser();
  const [nodes, alerts, activity] = await Promise.all([queries.nodes(), queries.alerts(), hasPermission(me, "audit.read") ? queries.auditLogs(10) : Promise.resolve([])]);
  return <DashboardView userName={me.name.split(" ")[0]} nodes={nodes} alerts={alerts} activity={activity} />;
}
