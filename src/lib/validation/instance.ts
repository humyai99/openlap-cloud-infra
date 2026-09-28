import { z } from "zod";

const hostname = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(63, "Name must be 63 characters or fewer")
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and hyphens (e.g. ubuntu-web-01)");

const ipv4 = z.string().regex(/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/\d{1,2})?$/, "Invalid IPv4 address");

export const createInstanceSchema = z
  .object({
    type: z.enum(["vm", "container"]),
    name: hostname,
    description: z.string().max(500).optional(),
    projectId: z.string().min(1, "Select a project"),
    nodeId: z.string().min(1, "Select a node"),
    os: z.object({
      family: z.enum(["ubuntu", "debian", "rocky", "alma", "fedora", "windows", "alpine", "custom"]),
      version: z.string().min(1),
      isoId: z.string().optional(),
    }),
    cpuCores: z.number().int().min(1).max(128),
    memoryMb: z.number().int().min(256).max(1024 * 1024),
    diskGb: z.number().int().min(1).max(16384),
    diskType: z.enum(["ssd", "hdd", "nvme"]),
    storagePoolId: z.string().min(1),
    networkId: z.string().min(1),
    vlanId: z.number().int().min(1).max(4094).nullable(),
    ipMode: z.enum(["dhcp", "static"]),
    staticIp: ipv4.optional(),
    firewallEnabled: z.boolean(),
    sshKey: z
      .string()
      .regex(/^(ssh-(rsa|ed25519)|ecdsa-sha2-\S+) \S+/, "Paste a public key starting with ssh-ed25519 / ssh-rsa")
      .optional()
      .or(z.literal("")),
    cloudInit: z.string().max(32_000).optional(),
  })
  .refine((v) => v.ipMode === "dhcp" || !!v.staticIp, { path: ["staticIp"], message: "Static IP is required" });

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;

export const powerActionSchema = z.object({
  action: z.enum(["start", "stop", "restart", "shutdown"]),
});

export const cloneSchema = z.object({ name: hostname });
export const snapshotSchema = z.object({ name: hostname, includeMemory: z.boolean().default(false) });

export const resizeSchema = z.object({
  cpuCores: z.number().int().min(1).max(128),
  memoryMb: z.number().int().min(256).max(1024 * 1024),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(256),
});

export const apiKeySchema = z.object({
  name: z.string().trim().min(2).max(64),
  expiresInDays: z.number().int().min(1).max(365).nullable(),
  scopes: z.array(z.string()).max(20).default([]),
});

const ipv4Only = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export const networkSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]{2,32}$/, "Lowercase letters, numbers, hyphens (2-32)"),
  type: z.enum(["bridge", "vlan", "nat"]),
  bridge: z.string().regex(/^[a-z0-9]{2,15}$/, "Bridge interface name, e.g. vmbr0").default("vmbr0"),
  cidr: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/([89]|[12]\d|30)$/, "IPv4 CIDR, e.g. 10.10.0.0/24"),
  gateway: z.string().regex(ipv4Only, "Invalid gateway IP"),
  dhcpStart: z.string().regex(ipv4Only, "Invalid IP").or(z.literal("")),
  dhcpEnd: z.string().regex(ipv4Only, "Invalid IP").or(z.literal("")),
  vlanId: z.number().int().min(1).max(4094).nullable(),
  dns: z.array(z.string().regex(ipv4Only, "Invalid DNS server")).max(4),
});

// ───────────── Identity administration ─────────────

const PERMISSION_KEYS = [
  "vm.create", "vm.delete", "vm.start", "vm.stop", "vm.console", "container.manage",
  "network.manage", "storage.manage", "node.manage", "user.manage", "audit.read",
] as const;

export const bindingSchema = z.object({ roleId: z.string().uuid(), projectId: z.string().uuid().nullable() });

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  bindings: z.array(bindingSchema).min(1, "Assign at least one role").max(20),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    bindings: z.array(bindingSchema).min(1).max(20).optional(),
  })
  .refine((v) => v.name || v.status || v.bindings, "Nothing to update");

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(50).regex(/^[\w .-]+$/, "Letters, numbers, spaces, . _ - only"),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length),
});

export const quotaSchema = z.object({
  scope: z.enum(["PROJECT", "USER", "TEAM"]),
  scopeId: z.string().uuid(),
  maxInstances: z.number().int().min(0).max(100_000),
  maxCpuCores: z.number().int().min(0).max(100_000),
  maxMemoryGb: z.number().int().min(0).max(1_000_000),
  maxStorageGb: z.number().int().min(0).max(10_000_000),
});

export const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password").max(256),
  next: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(256)
    .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Mix letters and numbers"),
});
