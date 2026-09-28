"use client";
import { Boxes, Loader2, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { loginSchema as schema } from "@/lib/validation/instance";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      if (!res.ok) {
        setErrors({ form: body?.error?.message ?? "Sign in failed" });
        return;
      }
      toast.success("Signed in");
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch {
      setErrors({ form: "Can't reach the server. Check your connection." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-4" />
          </div>
          <span className="font-semibold">OpenLab Cloud</span>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight">Build. Run. Experiment.</p>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Your open source private cloud for virtual machines, Linux containers and virtual networks — on your own hardware.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-xs text-muted-foreground">
            {["KVM / QEMU", "Incus / LXC", "libvirt"].map((t) => (
              <div key={t} className="rounded-lg border bg-card px-3 py-2 text-center">{t}</div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">100% open source · Apache-2.0</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-4">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">Sign in to your console</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use your OpenLab account credentials.</p>
          </div>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" name="email" type="email" autoComplete="username" placeholder="admin@openlab.local" />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Lock />} Sign in
          </Button>
          {errors.form && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{errors.form}</p>
          )}
        </form>
      </div>
    </div>
  );
}
