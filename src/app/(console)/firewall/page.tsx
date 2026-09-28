import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { queries } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Firewall" };

const ACTION_CLS = { allow: "text-emerald-500 border-emerald-500/30", drop: "text-red-500 border-red-500/30", reject: "text-amber-500 border-amber-500/30" };

export default async function FirewallPage() {
  const rules = (await queries.firewallRules()).sort((a, b) => b.priority - a.priority);
  return (
    <>
      <PageHeader title="Firewall" description="Rules evaluated by priority at Global, Node, VM and Container level." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>{["Priority", "Scope", "Direction", "Protocol", "Source", "Destination", "Port", "Action", "Comment"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 tabular-nums">{r.priority}</td>
                <td className="px-4 capitalize">{r.scope}{r.targetId && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.targetId}</span>}</td>
                <td className="px-4 uppercase text-xs">{r.direction}</td>
                <td className="px-4 uppercase text-xs">{r.protocol}</td>
                <td className="px-4 font-mono text-xs">{r.source}</td>
                <td className="px-4 font-mono text-xs">{r.destination}</td>
                <td className="px-4 font-mono text-xs">{r.port}</td>
                <td className="px-4"><Badge className={cn("uppercase", ACTION_CLS[r.action])}>{r.action}</Badge></td>
                <td className="px-4 text-xs text-muted-foreground">{r.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
