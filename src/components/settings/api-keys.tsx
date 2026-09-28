"use client";
import { Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api, ApiClientError, type ApiKeyInfo } from "@/lib/api/client";
import { formatDate, timeAgo } from "@/lib/utils";

export function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKeyInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<ApiKeyInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setKeys(await api.listApiKeys());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (name.length < 2) return toast.error("Give the key a name");
    const days = String(f.get("expires"));
    setBusy(true);
    try {
      const k = await api.createApiKey(name, days === "never" ? null : Number(days));
      setCreateOpen(false);
      setSecret(k.secret);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="API Keys"
        description="Personal tokens for the REST API. Send as Authorization: Bearer <key>. Keys inherit your role permissions."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus /> Create API Key</Button>}
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !keys ? (
        <Skeleton className="h-40 w-full" />
      ) : keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="No API keys" description="Create a key to automate OpenLab from scripts, Terraform or CI." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>{["Name", "Key", "Created", "Last used", "Expires", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 font-mono text-xs">{k.prefix}.••••••••</td>
                  <td className="px-4 text-xs text-muted-foreground">{formatDate(k.createdAt)}</td>
                  <td className="px-4 text-xs text-muted-foreground">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</td>
                  <td className="px-4 text-xs text-muted-foreground">{k.expiresAt ? formatDate(k.expiresAt) : "Never"}</td>
                  <td className="px-4">
                    {k.revokedAt ? <Badge className="text-muted-foreground">Revoked</Badge> : <Badge className="border-emerald-500/30 text-emerald-500">Active</Badge>}
                  </td>
                  <td className="px-4 text-right">
                    {!k.revokedAt && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setRevoke(k)}>Revoke</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Create API Key">
          <form onSubmit={create} className="space-y-4">
            <Field label="Name" htmlFor="k-name"><Input id="k-name" name="name" placeholder="terraform-ci" autoFocus /></Field>
            <Field label="Expires" htmlFor="k-exp">
              <Select id="k-exp" name="expires" defaultValue="90">
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent title="Copy your API key now" description="For security it is shown only once. Store it in a secret manager.">
          <div className="flex gap-2">
            <Input readOnly value={secret ?? ""} className="font-mono text-xs" aria-label="API key" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(secret ?? ""); toast.success("Copied"); }}><Copy /></Button>
          </div>
          <div className="mt-4 flex justify-end"><DialogClose asChild><Button>Done</Button></DialogClose></div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(o) => !o && setRevoke(null)}
        title={`Revoke "${revoke?.name}"?`}
        description="Anything using this key will stop working immediately. This cannot be undone."
        confirmLabel="Revoke"
        onConfirm={async () => {
          if (!revoke) return;
          try {
            await api.revokeApiKey(revoke.id);
            toast.success("API key revoked");
            void load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not revoke key");
          }
        }}
      />
    </>
  );
}
