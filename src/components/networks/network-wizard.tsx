"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { networkSchema } from "@/lib/validation/instance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";

export function NetworkWizard() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const r = networkSchema.safeParse({
      ...f,
      vlanId: f.vlanId ? Number(f.vlanId) : null,
      dns: f.dns.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setBusy(true);
    try {
      await api.createNetwork(r.data);
      toast.success(`Network ${r.data.name} created`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Create Network</Button></DialogTrigger>
      <DialogContent title="Create Network" description="Define a bridge, VLAN or NAT network." className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Network Name" htmlFor="n-name" error={errors.name}><Input id="n-name" name="name" placeholder="lab-net" /></Field>
          <Field label="Type" htmlFor="n-type"><Select id="n-type" name="type"><option value="bridge">Linux Bridge</option><option value="vlan">VLAN</option><option value="nat">NAT</option></Select></Field>
          <Field label="CIDR" htmlFor="n-cidr" error={errors.cidr}><Input id="n-cidr" name="cidr" placeholder="10.10.0.0/24" /></Field>
          <Field label="Gateway" htmlFor="n-gw" error={errors.gateway}><Input id="n-gw" name="gateway" placeholder="10.10.0.1" /></Field>
          <Field label="DHCP Range start" htmlFor="n-ds" error={errors.dhcpStart}><Input id="n-ds" name="dhcpStart" placeholder="10.10.0.100" /></Field>
          <Field label="DHCP Range end" htmlFor="n-de" error={errors.dhcpEnd}><Input id="n-de" name="dhcpEnd" placeholder="10.10.0.250" /></Field>
          <Field label="Bridge" htmlFor="n-br" error={errors.bridge}><Input id="n-br" name="bridge" defaultValue="vmbr0" /></Field>
          <Field label="VLAN ID" htmlFor="n-vl" error={errors.vlanId}><Input id="n-vl" name="vlanId" placeholder="optional" /></Field>
          <Field label="DNS" htmlFor="n-dns"><Input id="n-dns" name="dns" placeholder="1.1.1.1, 9.9.9.9" /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
