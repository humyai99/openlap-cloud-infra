import type { Metadata } from "next";
import { RolesView } from "@/components/admin/roles-view";
import { EmptyState } from "@/components/common";
import { listRoles } from "@/lib/server/admin";
import { hasPermission, requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const me = await requireUser();
  if (!hasPermission(me, "user.manage")) return <EmptyState title="Access denied" description="Your role doesn't include User Management." />;
  return <RolesView initialRoles={await listRoles()} myPermissions={[...me.global]} />;
}
