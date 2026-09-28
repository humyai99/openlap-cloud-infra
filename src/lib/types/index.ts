/**
 * Domain types shared by UI, API routes and providers.
 * These mirror the production REST API contract (see prisma/schema.prisma).
 */

export type UUID = string;
export type ISODate = string;

export type InstanceStatus = "running" | "stopped" | "starting" | "stopping" | "error";
export type InstanceType = "vm" | "container";
export type HealthState = "healthy" | "warning" | "critical";
export type NodeStatus = "online" | "offline" | "maintenance";
export type ProviderKind = "mock" | "incus" | "lxc" | "libvirt" | "proxmox" | "docker";

export type OsFamily =
  | "ubuntu"
  | "debian"
  | "rocky"
  | "alma"
  | "fedora"
  | "windows"
  | "alpine"
  | "custom";

export interface Timestamps {
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: UUID | null;
}

export interface Instance extends Timestamps {
  id: UUID;
  type: InstanceType;
  name: string;
  description?: string;
  status: InstanceStatus;
  nodeId: UUID;
  projectId: UUID;
  ownerId: UUID;
  os: { family: OsFamily; version: string };
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  ipv4: string | null;
  macAddress: string;
  uptimeSeconds: number;
  cpuUsage: number; // 0-100
  memoryUsage: number; // 0-100
  provider: ProviderKind;
  networkId: UUID;
  storagePoolId: UUID;
}

export interface Node extends Timestamps {
  id: UUID;
  name: string;
  status: NodeStatus;
  clusterId: UUID;
  cpuModel: string;
  cpuCores: number;
  memoryGb: number;
  storageTb: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  networkMbps: number;
  provider: ProviderKind;
  address: string;
  kernel: string;
}

export interface Project {
  id: UUID;
  name: string;
  organizationId: UUID;
}

export interface User extends Timestamps {
  id: UUID;
  name: string;
  email: string;
  role: RoleName;
  status: "active" | "invited" | "disabled";
  lastLoginAt: ISODate | null;
  teams: string[];
  bindings: RoleBinding[];
  mustChangePassword: boolean;
}

export interface RoleBinding {
  roleId: UUID;
  roleName: string;
  /** null = organization-wide */
  projectId: UUID | null;
  projectName: string | null;
}

export interface RoleInfo {
  id: UUID;
  name: string;
  description: string | null;
  builtIn: boolean;
  permissions: Permission[];
  assignments: number;
}

export interface QuotaRow {
  id: UUID;
  scope: "PROJECT" | "USER" | "TEAM";
  scopeId: UUID;
  label: string;
  maxInstances: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
}

export type RoleName = "Super Admin" | "Infrastructure Admin" | "Operator" | "Developer" | "Viewer";

export type Permission =
  | "vm.create"
  | "vm.delete"
  | "vm.start"
  | "vm.stop"
  | "vm.console"
  | "container.manage"
  | "network.manage"
  | "storage.manage"
  | "node.manage"
  | "user.manage"
  | "audit.read";

export interface StoragePool extends Timestamps {
  id: UUID;
  name: string;
  driver: "local" | "zfs" | "nfs" | "ceph" | "s3";
  nodeId: UUID | null;
  capacityGb: number;
  usedGb: number;
  content: Array<"images" | "iso" | "volumes" | "backups">;
}

export interface Volume {
  id: UUID;
  name: string;
  poolId: UUID;
  sizeGb: number;
  attachedTo: UUID | null;
  type: "ssd" | "hdd" | "nvme";
}

export interface Network extends Timestamps {
  id: UUID;
  name: string;
  type: "bridge" | "vlan" | "nat";
  cidr: string;
  ipv6Cidr: string | null;
  gateway: string;
  vlanId: number | null;
  bridge: string;
  dhcp: { enabled: boolean; start: string; end: string } | null;
  dns: string[];
  connectedInstances: number;
}

export interface FirewallRule {
  id: UUID;
  scope: "global" | "node" | "vm" | "container";
  targetId: UUID | null;
  direction: "in" | "out";
  protocol: "tcp" | "udp" | "icmp" | "any";
  source: string;
  destination: string;
  port: string;
  action: "allow" | "drop" | "reject";
  priority: number;
  comment?: string;
}

export interface Snapshot {
  id: UUID;
  instanceId: UUID;
  name: string;
  description?: string;
  sizeGb: number;
  createdAt: ISODate;
  includesMemory: boolean;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobKind =
  | "vm.create"
  | "vm.clone"
  | "vm.delete"
  | "vm.power"
  | "snapshot.create"
  | "snapshot.restore"
  | "backup.create"
  | "vm.migrate"
  | "vm.resize"
  | "snapshot.delete";

export interface JobStep {
  label: string;
  status: JobStatus;
}

export interface Job {
  id: UUID;
  kind: JobKind;
  status: JobStatus;
  progress: number; // 0-100
  steps: JobStep[];
  resourceId: UUID | null;
  resourceName: string;
  error: string | null;
  createdAt: ISODate;
  finishedAt: ISODate | null;
}

export interface AuditLog {
  id: UUID;
  user: string;
  action: string;
  resource: string;
  ipAddress: string;
  result: "success" | "failure";
  timestamp: ISODate;
}

export interface Alert {
  id: UUID;
  severity: "warning" | "critical";
  kind: "high_cpu" | "high_memory" | "disk_full" | "node_offline" | "vm_down";
  message: string;
  resource: string;
  createdAt: ISODate;
}

export interface MetricPoint {
  t: number; // epoch ms
  cpu: number;
  memory: number;
  netIn: number; // Mbps
  netOut: number;
  storage: number;
}

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

export interface ResourceQuota {
  scope: "user" | "team" | "project";
  scopeId: UUID;
  maxInstances: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
}

export interface QuotaUsage {
  quota: ResourceQuota;
  used: { instances: number; cpuCores: number; memoryGb: number; storageGb: number };
}

export interface DashboardSummary {
  vms: { running: number; stopped: number };
  containers: { running: number; stopped: number };
  nodes: { online: number; offline: number };
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  health: Record<HealthState, number>;
}

export type PowerAction = "start" | "stop" | "restart" | "shutdown";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
