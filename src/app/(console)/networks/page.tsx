import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { NetworkWizard } from "@/components/networks/network-wizard";
import { Badge } from "@/components/ui/badge";
import { queries } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Networks" };
export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  const networks = await queries.networks();
  return (
    <>
      <PageHeader title="Networks" description="Linux bridges, VLANs and NAT networks with IPv4/IPv6 and DHCP." actions={<NetworkWizard />} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>{["Network Name", "Type", "Subnet", "Gateway", "VLAN", "Bridge", "DHCP", "Connected"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {networks.map((n) => (
              <tr key={n.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-medium">{n.name}</td>
                <td className="px-4"><Badge className="uppercase">{n.type}</Badge></td>
                <td className="px-4 font-mono text-xs">{n.cidr}{n.ipv6Cidr && <div className="text-muted-foreground">{n.ipv6Cidr}</div>}</td>
                <td className="px-4 font-mono text-xs">{n.gateway}</td>
                <td className="px-4 tabular-nums">{n.vlanId ?? "—"}</td>
                <td className="px-4 font-mono text-xs">{n.bridge}</td>
                <td className="px-4 text-xs text-muted-foreground">{n.dhcp ? `${n.dhcp.start} – ${n.dhcp.end}` : "Off"}</td>
                <td className="px-4 tabular-nums">{n.connectedInstances}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
