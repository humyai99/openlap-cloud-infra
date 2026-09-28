"use client";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { BindingInput } from "@/lib/api/client";
import type { Project, RoleInfo } from "@/lib/types";

/** Edit a user's role bindings: each row = role + scope (organization-wide or one project). */
export function BindingsEditor({ value, onChange, roles, projects }: { value: BindingInput[]; onChange: (v: BindingInput[]) => void; roles: RoleInfo[]; projects: Project[] }) {
  const set = (i: number, patch: Partial<BindingInput>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={i} className="flex gap-2">
          <Select aria-label="Role" value={b.roleId} onChange={(e) => set(i, { roleId: e.target.value })}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.builtIn ? "" : " (custom)"}</option>
            ))}
          </Select>
          <Select aria-label="Scope" value={b.projectId ?? ""} onChange={(e) => set(i, { projectId: e.target.value || null })}>
            <option value="">All projects (organization)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>Project: {p.name}</option>
            ))}
          </Select>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove role" disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { roleId: roles.find((r) => r.name === "Viewer")?.id ?? roles[0].id, projectId: null }])}>
        <Plus /> Add role
      </Button>
    </div>
  );
}
