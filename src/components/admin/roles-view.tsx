"use client";
import { Check, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api/client";
import { PERMISSIONS } from "@/lib/rbac";
import type { Permission, RoleInfo } from "@/lib/types";
import { roleSchema } from "@/lib/validation/instance";

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");

export function RolesView({ initialRoles, myPermissions }: { initialRoles: RoleInfo[]; myPermissions: Permission[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<RoleInfo | "new" | null>(null);
  const [del, setDel] = useState<RoleInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      setRoles(await api.listRoles());
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, []);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Built-in roles are fixed. Create custom roles with exactly the permissions a team needs."
        actions={<Button onClick={() => setEditing("new")}><Plus /> Create Role</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.description || (r.builtIn ? "Built-in role" : "Custom role")}</p>
              </div>
              {r.builtIn ? (
                <Badge className="shrink-0 text-muted-foreground"><Lock className="size-3" /> Built-in</Badge>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-red-500" aria-label={`Delete ${r.name}`} onClick={() => setDel(r)}><Trash2 /></Button>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-1 flex-wrap content-start gap-1">
              {r.permissions.length === 0 && <span className="text-xs text-muted-foreground">Read-only (no permissions)</span>}
              {r.permissions.map((p) => (
                <Badge key={p} className="font-mono text-[10px] font-normal">{p}</Badge>
              ))}
            </div>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{r.assignments} assignment{r.assignments === 1 ? "" : "s"}</p>
          </Card>
        ))}
      </div>

      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          myPermissions={myPermissions}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            toast.success(msg);
            void reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete role "${del?.name}"?`}
        description={del?.assignments ? `It is assigned to ${del.assignments} user(s). Reassign them first.` : "This action cannot be undone."}
        onConfirm={async () => {
          if (!del) return;
          try {
            await api.deleteRole(del.id);
            toast.success(`Role ${del.name} deleted`);
            void reload();
          } catch (e) {
            toast.error(errMsg(e));
          }
        }}
      />
    </>
  );
}

function RoleDialog({ role, myPermissions, onClose, onSaved }: { role: RoleInfo | null; myPermissions: Permission[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const mine = new Set(myPermissions);

  async function save() {
    const r = roleSchema.safeParse({ name, description: description || undefined, permissions: [...perms] });
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
    setBusy(true);
    try {
      if (role) await api.updateRole(role.id, r.data);
      else await api.createRole(r.data);
      onSaved(role ? `Role ${r.data.name} updated` : `Role ${r.data.name} created`);
    } catch (e) {
      setErrors({ form: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={role ? `Edit ${role.name}` : "Create role"} description="You can only grant permissions you hold yourself." className="max-w-lg">
        <div className="space-y-4">
          <Field label="Name" htmlFor="r-name" error={errors.name}><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lab Instructor" autoFocus /></Field>
          <Field label="Description" htmlFor="r-desc" error={errors.description}><Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></Field>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Permissions</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PERMISSIONS.map((p) => {
                const allowed = mine.has(p.key);
                const on = perms.has(p.key);
                return (
                  <label key={p.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${!allowed ? "cursor-not-allowed opacity-40" : on ? "border-foreground/40 bg-accent" : "hover:bg-accent/50"}`} title={allowed ? undefined : "You don't hold this permission"}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      disabled={!allowed}
                      onChange={() => setPerms((s) => { const n = new Set(s); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; })}
                    />
                    <span className={`grid size-4 place-items-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : ""}`}>{on && <Check className="size-3" />}</span>
                    <span className="flex-1">{p.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {errors.form && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{errors.form}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {role ? "Save" : "Create role"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
