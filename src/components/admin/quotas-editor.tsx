"use client";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api/client";
import type { QuotaRow } from "@/lib/types";
import { quotaSchema } from "@/lib/validation/instance";

type Targets = Awaited<ReturnType<typeof api.listQuotas>>["targets"];
const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");

/** Editable per-project / per-user / per-team quotas. Enforced by the API before provisioning. */
export function QuotasEditor({ initial, targets }: { initial: QuotaRow[]; targets: Targets }) {
  const [rows, setRows] = useState(initial);
  const [edit, setEdit] = useState<QuotaRow | "new" | null>(null);
  const [del, setDel] = useState<QuotaRow | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows((await api.listQuotas()).quotas);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, []);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Quota Rules</CardTitle>
          <CardDescription>Every matching rule (project, owner, owner&apos;s teams) must pass before a VM or container is created. Projects without a rule use the default.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEdit("new")}><Plus /> Add quota</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>{["Scope", "Target", "Instances", "CPU", "RAM", "Storage", ""].map((h, i) => <th key={i} className="py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No quota rules yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5"><Badge className="font-normal capitalize">{r.scope.toLowerCase()}</Badge></td>
                <td className="font-mono text-xs">{r.label}</td>
                <td className="tabular-nums">{r.maxInstances}</td>
                <td className="tabular-nums">{r.maxCpuCores} cores</td>
                <td className="tabular-nums">{r.maxMemoryGb} GB</td>
                <td className="tabular-nums">{r.maxStorageGb} GB</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit quota for ${r.label}`} onClick={() => setEdit(r)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-red-500" aria-label={`Remove quota for ${r.label}`} onClick={() => setDel(r)}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      {edit && (
        <QuotaDialog
          row={edit === "new" ? null : edit}
          targets={targets}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.success("Quota saved");
            void reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Remove quota for ${del?.label}?`}
        description={del?.scope === "PROJECT" ? "The project falls back to the default quota." : "This target will no longer be limited by this rule."}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!del) return;
          try {
            await api.deleteQuota(del.id);
            toast.success("Quota removed");
            void reload();
          } catch (e) {
            toast.error(errMsg(e));
          }
        }}
      />
    </Card>
  );
}

function QuotaDialog({ row, targets, onClose, onSaved }: { row: QuotaRow | null; targets: Targets; onClose: () => void; onSaved: () => void }) {
  const [scope, setScope] = useState<QuotaRow["scope"]>(row?.scope ?? "PROJECT");
  const list = scope === "PROJECT" ? targets.projects : scope === "USER" ? targets.users : targets.teams;
  const [scopeId, setScopeId] = useState(row?.scopeId ?? list[0]?.id ?? "");
  const [v, setV] = useState({
    maxInstances: row?.maxInstances ?? 10,
    maxCpuCores: row?.maxCpuCores ?? 32,
    maxMemoryGb: row?.maxMemoryGb ?? 64,
    maxStorageGb: row?.maxStorageGb ?? 500,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (k: keyof typeof v, label: string, unit: string) => (
    <Field label={`${label} (${unit})`} htmlFor={`q-${k}`}>
      <Input id={`q-${k}`} type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
    </Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={row ? `Edit quota: ${row.label}` : "Add quota"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Scope" htmlFor="q-scope">
            <Select id="q-scope" value={scope} disabled={!!row} onChange={(e) => {
              const s = e.target.value as QuotaRow["scope"];
              setScope(s);
              setScopeId((s === "PROJECT" ? targets.projects : s === "USER" ? targets.users : targets.teams)[0]?.id ?? "");
            }}>
              <option value="PROJECT">Project</option>
              <option value="USER">User</option>
              <option value="TEAM">Team</option>
            </Select>
          </Field>
          <Field label="Target" htmlFor="q-target">
            <Select id="q-target" value={scopeId} disabled={!!row} onChange={(e) => setScopeId(e.target.value)}>
              {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          {num("maxInstances", "Max instances", "count")}
          {num("maxCpuCores", "Max CPU", "cores")}
          {num("maxMemoryGb", "Max RAM", "GB")}
          {num("maxStorageGb", "Max storage", "GB")}
        </div>
        {scope === "TEAM" && <p className="mt-3 text-xs text-muted-foreground">Applies to everything owned by the team&apos;s members combined.</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={busy || !scopeId}
            onClick={async () => {
              const r = quotaSchema.safeParse({ scope, scopeId, ...v });
              if (!r.success) return setError(r.error.issues[0]?.message ?? "Invalid values");
              setBusy(true);
              try {
                await api.setQuota(r.data);
                onSaved();
              } catch (e) {
                setError(errMsg(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
