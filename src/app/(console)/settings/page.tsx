import type { Metadata } from "next";
import { MockNotice, PageHeader } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { QuotasEditor } from "@/components/admin/quotas-editor";
import { listQuotas } from "@/lib/server/admin";
import { quotaUsage } from "@/lib/server/instances";
import { hasPermission, requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const PROVIDERS = [
  { kind: "mock", label: "Mock Provider", status: "Active", note: "Simulated hypervisor; state persisted in PostgreSQL" },
  { kind: "incus", label: "Incus / LXC", status: "Planned", note: "Phase 3 — first real provider" },
  { kind: "libvirt", label: "libvirt + KVM/QEMU", status: "Planned", note: "Phase 3" },
  { kind: "proxmox", label: "Proxmox VE API", status: "Future", note: "Adapter slot reserved" },
  { kind: "docker", label: "Docker", status: "Future", note: "Lightweight lab environments" },
];

export default async function SettingsPage() {
  const me = await requireUser();
  const projects = await queries.projects(me);
  const quotas = await Promise.all(projects.map((p) => quotaUsage(p.id)));
  const canManage = hasPermission(me, "user.manage");
  const rules = canManage ? await listQuotas() : null;
  return (
    <>
      <PageHeader title="Settings" description="Platform configuration, providers and quotas." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>General</CardTitle><CardDescription>Configured via environment variables</CardDescription></div></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform name" htmlFor="pn"><Input id="pn" defaultValue="OpenLab Cloud" disabled /></Field>
            <Field label="Organization" htmlFor="org"><Input id="org" defaultValue="org-1" disabled /></Field>
            <Field label="Default theme" htmlFor="th"><Select id="th" disabled defaultValue="dark"><option value="dark">Dark</option><option value="light">Light</option></Select></Field>
            <Field label="Session timeout" htmlFor="st"><Input id="st" defaultValue="8 hours" disabled /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Virtualization Providers</CardTitle><CardDescription>All hypervisor access goes through the provider layer</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {PROVIDERS.map((p) => (
              <div key={p.kind} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.note}</p></div>
                <span className={p.status === "Active" ? "text-xs text-amber-500" : "text-xs text-muted-foreground"}>{p.status}</span>
              </div>
            ))}
            <MockNotice className="mt-3" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Project Usage</CardTitle><CardDescription>Current usage against each project&apos;s quota</CardDescription></div></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {projects.map((p, idx) => {
              const { quota, used } = quotas[idx];
              const rows = [
                ["Instances", used.instances, quota.maxInstances, ""],
                ["CPU", used.cpuCores, quota.maxCpuCores, " cores"],
                ["RAM", used.memoryGb, quota.maxMemoryGb, " GB"],
                ["Storage", used.storageGb, quota.maxStorageGb, " GB"],
              ] as const;
              return (
                <div key={p.id} className="rounded-lg border p-4">
                  <p className="mb-3 font-mono text-sm font-medium">{p.name}</p>
                  <div className="space-y-2.5">
                    {rows.map(([l, u, m, unit]) => (
                      <div key={l}>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{l}</span><span className="tabular-nums">{u}/{m}{unit}</span></div>
                        <Progress value={(u / m) * 100} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {rules && <QuotasEditor initial={rules.quotas} targets={rules.targets} />}
      </div>
    </>
  );
}
