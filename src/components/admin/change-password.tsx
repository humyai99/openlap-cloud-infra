"use client";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api/client";
import { passwordSchema } from "@/lib/validation/instance";

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = passwordSchema.safeParse(v);
    const errs: Record<string, string> = r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
    if (v.next && v.confirm !== v.next) errs.confirm = "Passwords don't match";
    setErrors(errs);
    if (Object.keys(errs).length || !r.success) return;
    setBusy(true);
    try {
      await api.changePassword(r.data.current, r.data.next);
      toast.success("Password changed. Other sessions were signed out.");
      setV({ current: "", next: "", confirm: "" });
      router.refresh();
      if (forced) router.replace("/dashboard");
    } catch (err) {
      setErrors({ form: err instanceof ApiClientError ? err.message : "Could not change password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2"><KeyRound className="size-5" /></div>
        <div>
          <h2 className="font-semibold">{forced ? "Set a new password to continue" : "Change password"}</h2>
          <p className="text-xs text-muted-foreground">{forced ? "Your account has a temporary password from an administrator." : "Other signed-in sessions will be signed out."}</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={forced ? "Temporary password" : "Current password"} htmlFor="pw-cur" error={errors.current}>
          <Input id="pw-cur" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} autoFocus />
        </Field>
        <Field label="New password" htmlFor="pw-new" error={errors.next} hint="At least 12 characters, letters and numbers">
          <Input id="pw-new" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-conf" error={errors.confirm}>
          <Input id="pw-conf" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
        </Field>
        {errors.form && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{errors.form}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Change password</Button>
      </form>
    </Card>
  );
}
