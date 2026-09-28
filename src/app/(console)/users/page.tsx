import { Check, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { EmptyState } from "@/components/common";
import { hasPermission, requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";
import type { RoleName } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const STATUS_CLS = { active: "text-emerald-500 border-emerald-500/30", invited: "text-amber-500 border-amber-500/30", disabled: "text-muted-foreground" };

export default async function UsersPage() {
  const me = await requireUser();
  if (!hasPermission(me, "user.manage")) return <EmptyState title="Access denied" description="Your role doesn't include User Management." />;
  const users = await queries.users();
  const roles = Object.keys(ROLE_PERMISSIONS) as RoleName[];
  return (
    <>
      <PageHeader title="Users" description="Accounts, roles and permissions (RBAC)." actions={<Button disabled title="Phase 2"><UserPlus /> Invite User</Button>} />
      <div className="mb-6 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>{["User", "Role", "Teams", "Status", "Last login"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">{u.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
                    <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                  </div>
                </td>
                <td className="px-4">{u.role}</td>
                <td className="px-4 text-xs text-muted-foreground">{u.teams.join(", ") || "—"}</td>
                <td className="px-4"><Badge className={cn("capitalize", STATUS_CLS[u.status])}>{u.status}</Badge></td>
                <td className="px-4 text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <CardHeader><CardTitle>Role permissions</CardTitle><span className="text-xs text-muted-foreground">Custom roles supported in Phase 2</span></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-2 text-left font-medium">Permission</th>{roles.map((r) => <th key={r} className="px-2 font-medium">{r}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <td className="py-2">{p.label} <span className="ml-1 font-mono text-[10px] text-muted-foreground">{p.key}</span></td>
                  {roles.map((r) => (
                    <td key={r} className="text-center">
                      {ROLE_PERMISSIONS[r].includes(p.key) ? <Check className="mx-auto size-4 text-emerald-500" aria-label="granted" /> : <span className="text-muted-foreground/40" aria-label="denied">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
