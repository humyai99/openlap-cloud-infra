import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/admin/change-password";
import { PageHeader } from "@/components/common";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const me = await requireUser();
  return (
    <>
      <PageHeader title="Change password" description={me.email} />
      <ChangePasswordForm forced={me.mustChangePassword} />
    </>
  );
}
