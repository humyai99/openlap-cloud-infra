"use client";
import { Camera, Copy, MoreHorizontal, Pencil, Play, Power, RotateCw, Square, SquareTerminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { runJob, usePowerAction } from "@/lib/hooks";
import type { Instance } from "@/lib/types";
import { cloneSchema } from "@/lib/validation/instance";

function NameDialog({ open, onOpenChange, title, label, initial, submitLabel, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; label: string; initial: string; submitLabel: string; onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const r = cloneSchema.safeParse({ name });
            if (!r.success) return setErr(r.error.issues[0]?.message);
            onSubmit(r.data.name);
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <Field label={label} htmlFor="nm" error={err}>
            <Input id="nm" value={name} onChange={(e) => { setName(e.target.value); setErr(undefined); }} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Row-level action menu shared by VM and container tables and the detail header. */
export function InstanceActions({ inst, onChanged, trigger }: { inst: Instance; onChanged?: () => void; trigger?: React.ReactNode }) {
  const power = usePowerAction(onChanged);
  const [dlg, setDlg] = useState<null | "delete" | "clone" | "snapshot">(null);
  const running = inst.status === "running";
  const stopped = inst.status === "stopped";
  const kind = inst.type === "vm" ? "VM" : "Container";
  const base = inst.type === "vm" ? "/vms" : "/containers";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${inst.name}`}>
              <MoreHorizontal />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild disabled={!running}>
            <Link href={`${base}/${inst.id}?tab=console`}><SquareTerminal /> Open Console</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!stopped} onSelect={() => power(inst, "start")}><Play /> Start</DropdownMenuItem>
          <DropdownMenuItem disabled={!running} onSelect={() => power(inst, "stop")}><Square /> Stop</DropdownMenuItem>
          <DropdownMenuItem disabled={!running} onSelect={() => power(inst, "restart")}><RotateCw /> Restart</DropdownMenuItem>
          <DropdownMenuItem disabled={!running} onSelect={() => power(inst, "shutdown")}><Power /> Shutdown</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDlg("clone")}><Copy /> Clone</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDlg("snapshot")}><Camera /> Snapshot</DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`${base}/${inst.id}?tab=hardware`}><Pencil /> Edit</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDlg("delete")}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dlg === "delete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Delete "${inst.name}"?`}
        description={`This ${kind.toLowerCase()} and its disks will be permanently removed. This action cannot be undone.`}
        requireText={inst.name}
        onConfirm={() => {
          void runJob(() => api.deleteInstance(inst.id), { loading: `Deleting ${inst.name}…`, success: `${kind} ${inst.name} deleted` }, onChanged);
        }}
      />
      {dlg === "clone" && (
        <NameDialog open onOpenChange={(o) => !o && setDlg(null)} title={`Clone ${inst.name}`} label="New name" initial={`${inst.name}-clone`} submitLabel="Clone"
          onSubmit={(name) => void runJob(() => api.clone(inst.id, name), { loading: `Cloning ${inst.name}…`, success: `${kind} cloned as ${name}` }, onChanged)} />
      )}
      {dlg === "snapshot" && (
        <NameDialog open onOpenChange={(o) => !o && setDlg(null)} title={`Snapshot ${inst.name}`} label="Snapshot name" initial={`snap-${new Date().toISOString().slice(0, 10)}`} submitLabel="Create snapshot"
          onSubmit={(name) => void runJob(() => api.createSnapshot(inst.id, name), { loading: `Creating snapshot ${name}…`, success: "Snapshot created" }, onChanged)} />
      )}
    </>
  );
}
