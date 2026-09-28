import type { Permission, RoleName } from "@/lib/types";

export const PERMISSIONS: Array<{ key: Permission; label: string }> = [
  { key: "vm.create", label: "VM Create" },
  { key: "vm.delete", label: "VM Delete" },
  { key: "vm.start", label: "VM Start" },
  { key: "vm.stop", label: "VM Stop" },
  { key: "vm.console", label: "VM Console" },
  { key: "container.manage", label: "Container Management" },
  { key: "network.manage", label: "Network Management" },
  { key: "storage.manage", label: "Storage Management" },
  { key: "node.manage", label: "Node Management" },
  { key: "user.manage", label: "User Management" },
  { key: "audit.read", label: "Audit Log Access" },
];

const ALL = PERMISSIONS.map((p) => p.key);

/** Built-in roles. Custom roles are stored in the roles/role_permissions tables (Phase 2). */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  "Super Admin": ALL,
  "Infrastructure Admin": ALL.filter((p) => p !== "user.manage"),
  Operator: ["vm.start", "vm.stop", "vm.console", "container.manage", "audit.read"],
  Developer: ["vm.create", "vm.start", "vm.stop", "vm.console", "container.manage"],
  Viewer: [],
};

export function can(role: RoleName, perm: Permission) {
  return ROLE_PERMISSIONS[role].includes(perm);
}
