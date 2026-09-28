"use client";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MockNotice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { api, ApiClientError, waitForJob } from "@/lib/api/client";
import { OS_CATALOG } from "@/lib/mock/os";
import type { InstanceType, Job, Network, Node, OsFamily, Project, QuotaUsage, StoragePool } from "@/lib/types";
import { cn, formatGb, formatMemory } from "@/lib/utils";
import { createInstanceSchema, type CreateInstanceInput } from "@/lib/validation/instance";

const STEPS = ["General", "Operating System", "Compute", "Storage", "Network", "Security", "Review"] as const;
const CPU_PRESETS = [1, 2, 4, 8, 16];
const MEM_PRESETS_GB = [1, 2, 4, 8, 16, 32];

/** Which form fields belong to which step — used to jump back to the step that has an error. */
const FIELD_STEP: Record<string, number> = {
  name: 0, description: 0, projectId: 0, nodeId: 0, os: 1, cpuCores: 2, memoryMb: 2,
  diskGb: 3, storagePoolId: 3, diskType: 3, networkId: 4, vlanId: 4, ipMode: 4, staticIp: 4, sshKey: 5, cloudInit: 5,
};

function Choice({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent", active && "border-foreground/60 bg-accent font-medium ring-1 ring-foreground/20", className)}>
      {children}
    </button>
  );
}

export function CreateWizard({ initialType, nodes, projects, pools, networks, quotas }: {
  initialType: InstanceType; nodes: Node[]; projects: Project[]; pools: StoragePool[]; networks: Network[]; quotas: Record<string, QuotaUsage>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [job, setJob] = useState<Job | null>(null);
  const [customCpu, setCustomCpu] = useState(false);
  const [customMem, setCustomMem] = useState(false);
  const [v, setV] = useState<CreateInstanceInput>({
    type: initialType,
    name: "",
    description: "",
    projectId: projects[0]?.id ?? "",
    nodeId: nodes.find((n) => n.status === "online")?.id ?? "",
    os: { family: "ubuntu", version: "24.04 LTS" },
    cpuCores: 2,
    memoryMb: 4096,
    diskGb: initialType === "vm" ? 40 : 10,
    diskType: "ssd",
    storagePoolId: pools.find((p) => p.content.includes("volumes"))?.id ?? pools[0]?.id ?? "",
    networkId: networks[0]?.id ?? "",
    vlanId: networks[0]?.vlanId ?? null,
    ipMode: "dhcp",
    staticIp: undefined,
    firewallEnabled: true,
    sshKey: "",
    cloudInit: "#cloud-config\npackage_update: true\npackages:\n  - qemu-guest-agent\n",
  });
  const set = <K extends keyof CreateInstanceInput>(k: K, val: CreateInstanceInput[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const kind = v.type === "vm" ? "Virtual Machine" : "Container";
  const node = nodes.find((n) => n.id === v.nodeId);
  const pool = pools.find((p) => p.id === v.storagePoolId);
  const net = networks.find((n) => n.id === v.networkId);
  const quota = quotas[v.projectId];

  function validate(upTo: number) {
    const r = createInstanceSchema.safeParse(v);
    if (r.success) return true;
    const errs: Record<string, string> = {};
    let first = Infinity;
    for (const issue of r.error.issues) {
      const key = String(issue.path[0]);
      const s = FIELD_STEP[key] ?? 0;
      if (s <= upTo && !errs[key]) {
        errs[key] = issue.message;
        first = Math.min(first, s);
      }
    }
    setErrors(errs);
    if (first !== Infinity) {
      setStep(first);
      return false;
    }
    return true;
  }

  async function submit() {
    if (!validate(STEPS.length)) return;
    try {
      const created = await api.createInstance(v);
      setJob(created);
      const final = await waitForJob(created.id, setJob);
      if (final.status === "completed") toast.success(`${kind} ${v.name} created successfully`);
      else toast.error(final.error ?? "Provisioning failed");
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Could not reach the API. Check your connection and try again.";
      toast.error(msg);
      setJob(null);
    }
  }

  if (job) return <Provisioning job={job} kind={kind} onOpen={() => job.resourceId && router.push(`${v.type === "vm" ? "/vms" : "/containers"}/${job.resourceId}`)} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step}
              className={cn("flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm", i === step ? "bg-accent font-medium" : "text-muted-foreground", i < step && "hover:bg-accent/60")}
              aria-current={i === step ? "step" : undefined}>
              <span className={cn("grid size-5 place-items-center rounded-full border text-[10px]", i < step && "border-emerald-500 bg-emerald-500 text-white", i === step && "border-foreground")}>
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-base font-semibold">{STEPS[step]}</h2>
        <p className="mb-6 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Instance type</p>
              <div className="flex gap-2">
                <Choice active={v.type === "vm"} onClick={() => set("type", "vm")}>Virtual Machine (KVM)</Choice>
                <Choice active={v.type === "container"} onClick={() => set("type", "container")}>Container (LXC)</Choice>
              </div>
            </div>
            <Field label={`${kind} Name`} htmlFor="name" error={errors.name} hint="Lowercase, numbers, hyphens. Used as hostname.">
              <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="ubuntu-web-01" autoFocus />
            </Field>
            <Field label="Project" htmlFor="project" error={errors.projectId}>
              <Select id="project" value={v.projectId} onChange={(e) => set("projectId", e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Node" htmlFor="node" error={errors.nodeId}>
              <Select id="node" value={v.nodeId} onChange={(e) => set("nodeId", e.target.value)}>
                {nodes.map((n) => <option key={n.id} value={n.id} disabled={n.status !== "online"}>{n.name} — CPU {n.cpuUsage}% · RAM {n.memoryUsage}%</option>)}
              </Select>
            </Field>
            <Field label="Description" htmlFor="desc">
              <Input id="desc" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OS_CATALOG.filter((o) => v.type === "vm" ? o.family !== "alpine" : o.family !== "windows" && o.family !== "custom").map((o) => (
                <button key={o.family} type="button" aria-pressed={v.os.family === o.family}
                  onClick={() => set("os", { family: o.family as OsFamily, version: o.versions[0] })}
                  className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:bg-accent", v.os.family === o.family && "border-foreground/60 bg-accent ring-1 ring-foreground/20")}>
                  <span className="grid size-10 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: o.color }}>{o.initials}</span>
                  <span className="text-sm font-medium">{o.label}</span>
                </button>
              ))}
            </div>
            <Field label="Version" htmlFor="osv">
              <Select id="osv" value={v.os.version} onChange={(e) => set("os", { ...v.os, version: e.target.value })} className="sm:w-64">
                {OS_CATALOG.find((o) => o.family === v.os.family)?.versions.map((ver) => <option key={ver}>{ver}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">CPU Cores</p>
              <div className="flex flex-wrap gap-2">
                {CPU_PRESETS.map((c) => <Choice key={c} active={!customCpu && v.cpuCores === c} onClick={() => { setCustomCpu(false); set("cpuCores", c); }}>{c} vCPU</Choice>)}
                <Choice active={customCpu} onClick={() => setCustomCpu(true)}>Custom</Choice>
              </div>
              {customCpu && <Input type="number" min={1} max={128} className="mt-2 w-32" value={v.cpuCores} onChange={(e) => set("cpuCores", Number(e.target.value))} aria-label="Custom CPU cores" />}
              {errors.cpuCores && <p className="mt-1 text-xs text-red-500">{errors.cpuCores}</p>}
              {node && <p className="mt-2 text-xs text-muted-foreground">{node.name}: {node.cpuModel}, {node.cpuCores} cores</p>}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Memory</p>
              <div className="flex flex-wrap gap-2">
                {MEM_PRESETS_GB.map((g) => <Choice key={g} active={!customMem && v.memoryMb === g * 1024} onClick={() => { setCustomMem(false); set("memoryMb", g * 1024); }}>{g} GB</Choice>)}
                <Choice active={customMem} onClick={() => setCustomMem(true)}>Custom</Choice>
              </div>
              {customMem && (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="number" min={256} step={256} className="w-32" value={v.memoryMb} onChange={(e) => set("memoryMb", Number(e.target.value))} aria-label="Custom memory in MB" />
                  <span className="text-xs text-muted-foreground">MB</span>
                </div>
              )}
              {errors.memoryMb && <p className="mt-1 text-xs text-red-500">{errors.memoryMb}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Disk Size (GB)" htmlFor="disk" error={errors.diskGb}>
              <Input id="disk" type="number" min={1} value={v.diskGb} onChange={(e) => set("diskGb", Number(e.target.value))} />
            </Field>
            <Field label="Storage Pool" htmlFor="pool" error={errors.storagePoolId} hint={pool ? `${formatGb(pool.capacityGb - pool.usedGb)} free of ${formatGb(pool.capacityGb)} (${pool.driver.toUpperCase()})` : undefined}>
              <Select id="pool" value={v.storagePoolId} onChange={(e) => set("storagePoolId", e.target.value)}>
                {pools.filter((p) => p.content.includes("volumes") || p.content.includes("images")).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Disk Type</p>
              <div className="flex gap-2">
                {(["ssd", "hdd", "nvme"] as const).map((t) => <Choice key={t} active={v.diskType === t} onClick={() => set("diskType", t)}>{t.toUpperCase()}</Choice>)}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Network" htmlFor="net">
              <Select id="net" value={v.networkId} onChange={(e) => { const n = networks.find((x) => x.id === e.target.value); set("networkId", e.target.value); set("vlanId", n?.vlanId ?? null); }}>
                {networks.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.cidr})</option>)}
              </Select>
            </Field>
            <Field label="Bridge" htmlFor="br"><Input id="br" value={net?.bridge ?? ""} readOnly className="bg-muted/40" /></Field>
            <Field label="VLAN ID" htmlFor="vlan" error={errors.vlanId} hint="Leave empty for untagged">
              <Input id="vlan" type="number" min={1} max={4094} value={v.vlanId ?? ""} onChange={(e) => set("vlanId", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">IP Mode</p>
              <div className="flex gap-2">
                <Choice active={v.ipMode === "dhcp"} onClick={() => set("ipMode", "dhcp")}>DHCP</Choice>
                <Choice active={v.ipMode === "static"} onClick={() => set("ipMode", "static")}>Static</Choice>
              </div>
            </div>
            {v.ipMode === "static" && (
              <Field label="Static IP (CIDR)" htmlFor="sip" error={errors.staticIp} hint={net ? `Subnet ${net.cidr}, gateway ${net.gateway}` : undefined}>
                <Input id="sip" value={v.staticIp ?? ""} onChange={(e) => set("staticIp", e.target.value || undefined)} placeholder="10.10.0.50/24" />
              </Field>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Firewall</span>
                <span className="text-xs text-muted-foreground">Apply global + instance-level firewall rules</span>
              </span>
              <input type="checkbox" className="size-4 accent-emerald-500" checked={v.firewallEnabled} onChange={(e) => set("firewallEnabled", e.target.checked)} />
            </label>
            <Field label="SSH Public Key" htmlFor="ssh" error={errors.sshKey} hint="Injected via cloud-init for the default user">
              <Textarea id="ssh" value={v.sshKey} onChange={(e) => set("sshKey", e.target.value)} placeholder="ssh-ed25519 AAAA… user@host" rows={2} />
            </Field>
            <Field label="Cloud-init user-data" htmlFor="ci">
              <Textarea id="ci" value={v.cloudInit} onChange={(e) => set("cloudInit", e.target.value)} rows={7} />
            </Field>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
              {[
                ["Name", v.name || "—"],
                ["Type", kind],
                ["OS", `${OS_CATALOG.find((o) => o.family === v.os.family)?.label} ${v.os.version}`],
                ["Node", node?.name ?? "—"],
                ["CPU", `${v.cpuCores} vCPU`],
                ["RAM", formatMemory(v.memoryMb)],
                ["Storage", `${v.diskGb} GB ${v.diskType.toUpperCase()} on ${pool?.name}`],
                ["Network", `${net?.name} · ${v.ipMode === "dhcp" ? "DHCP" : v.staticIp}${v.vlanId ? ` · VLAN ${v.vlanId}` : ""}`],
                ["Firewall", v.firewallEnabled ? "Enabled" : "Disabled"],
                ["SSH Key", v.sshKey ? "Provided" : "None"],
              ].map(([k, val]) => (
                <div key={k} className="bg-card px-4 py-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="mt-0.5 text-sm font-medium">{val}</div>
                </div>
              ))}
            </div>
            {quota && (
              <div className="rounded-lg border p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Project quota after creation</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ["CPU", quota.used.cpuCores + v.cpuCores, quota.quota.maxCpuCores, "cores"],
                    ["Memory", Math.round(quota.used.memoryGb + v.memoryMb / 1024), quota.quota.maxMemoryGb, "GB"],
                    ["Storage", quota.used.storageGb + v.diskGb, quota.quota.maxStorageGb, "GB"],
                  ] as const).map(([l, used, max, unit]) => (
                    <div key={l}>
                      <div className="mb-1 flex justify-between text-xs"><span>{l}</span><span className={cn("tabular-nums", used > max && "text-red-500")}>{used}/{max} {unit}</span></div>
                      <Progress value={(used / max) * 100} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <MockNotice />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-5">
          {step === 0 ? (
            <Button variant="ghost" asChild><Link href={v.type === "vm" ? "/vms" : "/containers"}>Cancel</Link></Button>
          ) : (
            <Button variant="outline" onClick={() => setStep(step - 1)}><ChevronLeft /> Back</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => validate(step) && setStep(step + 1)}>Next <ChevronRight /></Button>
          ) : (
            <Button onClick={submit}>Create {kind}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Provisioning({ job, kind, onOpen }: { job: Job; kind: string; onOpen: () => void }) {
  const done = job.status === "completed";
  const failed = job.status === "failed";
  return (
    <Card className="mx-auto max-w-lg p-6">
      <div className="mb-5 flex items-center gap-3">
        {done ? <CheckCircle2 className="size-6 text-emerald-500" /> : failed ? <XCircle className="size-6 text-red-500" /> : <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        <div>
          <h2 className="font-semibold">{done ? `${kind} ready` : failed ? "Provisioning failed" : `Provisioning ${job.resourceName}`}</h2>
          <p className="text-xs text-muted-foreground">Job <span className="font-mono">{job.id.slice(0, 13)}</span> · {job.status}</p>
        </div>
      </div>
      <Progress value={job.progress} colorByValue={false} className="mb-5 h-2" />
      <ol className="space-y-3" aria-live="polite">
        {job.steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            {s.status === "completed" ? <CheckCircle2 className="size-4 text-emerald-500" /> : s.status === "running" ? <Loader2 className="size-4 animate-spin" /> : s.status === "failed" ? <XCircle className="size-4 text-red-500" /> : <Circle className="size-4 text-muted-foreground/40" />}
            <span className={cn(s.status === "queued" && "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ol>
      {failed && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{job.error}</p>}
      {(done || failed) && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" asChild><Link href="/vms">Back to list</Link></Button>
          {done && <Button onClick={onOpen}>Open {kind}</Button>}
        </div>
      )}
    </Card>
  );
}
