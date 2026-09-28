"use client";
import { KeyRound, Loader2, MoreHorizontal, Pencil, Search, UserCheck, UserPlus, UserX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/input";
import { api, ApiClientError, type BindingInput } from "@/lib/api/client";
import type { Project, RoleInfo, User } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { inviteUserSchema } from "@/lib/validation/instance";
import { BindingsEditor } from "./bindings-editor";
import { SecretDialog } from "./secret-dialog";

const STATUS_CLS = { active: "text-emerald-500 border-emerald-500/30", invited: "text-amber-500 border-amber-500/30", disabled: "text-muted-foreground" };
const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");

export function UsersView({ initialUsers, roles, projects, meId }: { initialUsers: User[]; roles: RoleInfo[]; projects: Project[]; meId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{ user: User; kind: "disable" | "enable" | "reset" } | null>(null);
  const [secret, setSecret] = useState<{ value: string; email: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, []);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? users.filter((u) => u.name.toLowerCase().includes(n) || u.email.includes(n)) : users;
  }, [users, q]);

  const defaultRole = roles.find((r) => r.name === "Developer") ?? roles[0];

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts and role bindings. A role can apply to the whole organization or to a single project."
        actions={<Button onClick={() => setInvite(true)}><UserPlus /> Invite User</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>{["User", "Roles", "Teams", "Status", "Last login", ""].map((h, i) => <th key={i} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No users match “{q}”.</td></tr>
            )}
            {shown.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {u.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{u.name}{u.id === meId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4">
                  <div className="flex flex-wrap gap-1">
                    {u.bindings.map((b, i) => (
                      <Badge key={i} className="font-normal">
                        {b.roleName}
                        {b.projectName && <span className="text-muted-foreground">@{b.projectName}</span>}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 text-xs text-muted-foreground">{u.teams.join(", ") || "—"}</td>
                <td className="px-4">
                  <Badge className={cn("capitalize", STATUS_CLS[u.status])}>{u.status}</Badge>
                  {u.mustChangePassword && u.status === "active" && <span className="ml-1.5 text-[11px] text-amber-500">temp password</span>}
                </td>
                <td className="px-4 text-xs text-muted-foreground" suppressHydrationWarning>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                <td className="px-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${u.email}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem disabled={u.id === meId} onSelect={() => setEdit(u)}><Pencil /> Edit roles</DropdownMenuItem>
                      <DropdownMenuItem disabled={u.id === meId} onSelect={() => setConfirm({ user: u, kind: "reset" })}><KeyRound /> Reset password</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.status === "disabled" ? (
                        <DropdownMenuItem onSelect={() => setConfirm({ user: u, kind: "enable" })}><UserCheck /> Enable</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem destructive disabled={u.id === meId} onSelect={() => setConfirm({ user: u, kind: "disable" })}><UserX /> Disable</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invite && (
        <InviteDialog
          roles={roles}
          projects={projects}
          defaultRoleId={defaultRole.id}
          onClose={() => setInvite(false)}
          onCreated={(email, pw) => {
            setInvite(false);
            setSecret({ value: pw, email });
            void reload();
          }}
        />
      )}
      {edit && (
        <EditRolesDialog
          user={edit}
          roles={roles}
          projects={projects}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.success("Roles updated — the user will need to sign in again");
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "disable" ? `Disable ${confirm.user.email}?`
          : confirm?.kind === "enable" ? `Enable ${confirm.user.email}?`
          : `Reset password for ${confirm?.user.email}?`
        }
        description={
          confirm?.kind === "disable" ? "They are signed out immediately and their API keys stop working. You can enable the account again later."
          : confirm?.kind === "enable" ? "They will be able to sign in again with their current password."
          : "Their current password stops working and all their sessions are signed out. You'll get a one-time temporary password to share."
        }
        confirmLabel={confirm?.kind === "disable" ? "Disable" : confirm?.kind === "enable" ? "Enable" : "Reset password"}
        onConfirm={async () => {
          if (!confirm) return;
          const { user, kind } = confirm;
          try {
            if (kind === "reset") {
              const r = await api.resetPassword(user.id);
              setSecret({ value: r.temporaryPassword, email: user.email });
            } else {
              await api.updateUser(user.id, { status: kind === "disable" ? "DISABLED" : "ACTIVE" });
              toast.success(kind === "disable" ? `${user.email} disabled` : `${user.email} enabled`);
            }
            void reload();
          } catch (e) {
            toast.error(errMsg(e));
          }
        }}
      />

      <SecretDialog
        secret={secret?.value ?? null}
        title={`Temporary password for ${secret?.email}`}
        description="They must change it the first time they sign in."
        onClose={() => setSecret(null)}
      />
    </>
  );
}

function InviteDialog({ roles, projects, defaultRoleId, onClose, onCreated }: {
  roles: RoleInfo[]; projects: Project[]; defaultRoleId: string; onClose: () => void; onCreated: (email: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bindings, setBindings] = useState<BindingInput[]>([{ roleId: defaultRoleId, projectId: projects[0]?.id ?? null }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = inviteUserSchema.safeParse({ name, email, bindings });
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setBusy(true);
    try {
      const res = await api.inviteUser(r.data);
      onCreated(res.email, res.temporaryPassword);
    } catch (err) {
      setErrors({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Invite user" description="Creates the account with a one-time temporary password." className="max-w-xl">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="iu-name" error={errors.name}><Input id="iu-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label="Email" htmlFor="iu-email" error={errors.email}><Input id="iu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Roles</p>
            <BindingsEditor value={bindings} onChange={setBindings} roles={roles} projects={projects} />
            {errors.bindings && <p className="mt-1 text-xs text-red-500">{errors.bindings}</p>}
          </div>
          {errors.form && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{errors.form}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Invite</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({ user, roles, projects, onClose, onSaved }: { user: User; roles: RoleInfo[]; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [bindings, setBindings] = useState<BindingInput[]>(user.bindings.map((b) => ({ roleId: b.roleId, projectId: b.projectId })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Roles for ${user.email}`} description="Permissions from all bindings are combined." className="max-w-xl">
        <BindingsEditor value={bindings} onChange={setBindings} roles={roles} projects={projects} />
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.updateUser(user.id, { bindings });
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
