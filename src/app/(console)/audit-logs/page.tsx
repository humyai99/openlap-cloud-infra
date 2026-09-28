import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common";
import { hasPermission, requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const me = await requireUser();
  if (!hasPermission(me, "audit.read")) return <EmptyState title="Access denied" description="Your role doesn't include Audit Log Access." />;
  const logs = await queries.auditLogs(500);
  return (
    <>
      <PageHeader title="Audit Logs" description="Every action is recorded with user, resource, source IP and result." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>{["Timestamp", "User", "Action", "Resource", "IP Address", "Result"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{new Date(l.timestamp).toLocaleString("en-GB")}</td>
                <td className="px-4 font-medium">{l.user}</td>
                <td className="px-4">{l.action}</td>
                <td className="px-4 font-mono text-xs">{l.resource}</td>
                <td className="px-4 font-mono text-xs">{l.ipAddress}</td>
                <td className="px-4"><Badge className={cn("capitalize", l.result === "success" ? "border-emerald-500/30 text-emerald-500" : "border-red-500/30 text-red-500")}>{l.result}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
