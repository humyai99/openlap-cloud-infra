/**
 * MOCK DATA — seed for the in-memory Mock Provider (Phase 1).
 * No hypervisor is connected. Everything here is simulated.
 */
import type {
  Alert,
  AuditLog,
  FirewallRule,
  Instance,
  InstanceStatus,
  MetricPoint,
  Network,
  Node,
  OsFamily,
  Project,
  Snapshot,
  StoragePool,
  TimeRange,
  User,
  Volume,
} from "@/lib/types";

const NOW = Date.UTC(2026, 8, 27, 9, 0, 0);
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const H = 3_600_000;
const D = 24 * H;

/** Small deterministic PRNG so server and client render identical mock values. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ts = (ago: number) => ({ createdAt: iso(ago), updatedAt: iso(ago / 2), createdBy: "u-admin" });

export const projects: Project[] = [
  { id: "p-default", name: "default", organizationId: "org-1" },
  { id: "p-web", name: "web-platform", organizationId: "org-1" },
  { id: "p-lab", name: "university-lab", organizationId: "org-1" },
];

export const nodes: Node[] = [
  {
    id: "n-01", name: "node-01", status: "online", clusterId: "c-main", cpuModel: "AMD EPYC 7543",
    cpuCores: 64, memoryGb: 256, storageTb: 4, cpuUsage: 48, memoryUsage: 67, storageUsage: 72,
    networkMbps: 842, provider: "mock", address: "10.0.0.11", kernel: "6.8.0-45-generic", ...ts(120 * D),
  },
  {
    id: "n-02", name: "node-02", status: "online", clusterId: "c-main", cpuModel: "AMD EPYC 7543",
    cpuCores: 64, memoryGb: 256, storageTb: 4, cpuUsage: 39, memoryUsage: 58, storageUsage: 69,
    networkMbps: 611, provider: "mock", address: "10.0.0.12", kernel: "6.8.0-45-generic", ...ts(120 * D),
  },
  {
    id: "n-03", name: "node-03", status: "online", clusterId: "c-main", cpuModel: "Intel Xeon Gold 6338",
    cpuCores: 32, memoryGb: 128, storageTb: 2, cpuUsage: 83, memoryUsage: 61, storageUsage: 74,
    networkMbps: 390, provider: "mock", address: "10.0.0.13", kernel: "6.8.0-45-generic", ...ts(60 * D),
  },
];

export const networks: Network[] = [
  { id: "net-lan", name: "lan-default", type: "bridge", cidr: "10.10.0.0/24", ipv6Cidr: "fd00:10::/64", gateway: "10.10.0.1", vlanId: null, bridge: "vmbr0", dhcp: { enabled: true, start: "10.10.0.100", end: "10.10.0.250" }, dns: ["1.1.1.1", "9.9.9.9"], connectedInstances: 0, ...ts(100 * D) },
  { id: "net-web", name: "web-dmz", type: "vlan", cidr: "10.20.0.0/24", ipv6Cidr: null, gateway: "10.20.0.1", vlanId: 20, bridge: "vmbr0", dhcp: { enabled: true, start: "10.20.0.50", end: "10.20.0.200" }, dns: ["10.20.0.1"], connectedInstances: 0, ...ts(90 * D) },
  { id: "net-lab", name: "lab-isolated", type: "nat", cidr: "172.16.50.0/24", ipv6Cidr: null, gateway: "172.16.50.1", vlanId: 50, bridge: "vmbr1", dhcp: { enabled: true, start: "172.16.50.10", end: "172.16.50.250" }, dns: ["172.16.50.1"], connectedInstances: 0, ...ts(40 * D) },
  { id: "net-stor", name: "storage-backend", type: "vlan", cidr: "10.99.0.0/24", ipv6Cidr: null, gateway: "10.99.0.1", vlanId: 99, bridge: "vmbr2", dhcp: null, dns: [], connectedInstances: 0, ...ts(100 * D) },
];

export const storagePools: StoragePool[] = [
  { id: "sp-local", name: "local", driver: "local", nodeId: "n-01", capacityGb: 1024, usedGb: 612, content: ["iso", "images"], ...ts(120 * D) },
  { id: "sp-zfs", name: "local-zfs", driver: "zfs", nodeId: "n-01", capacityGb: 3072, usedGb: 2210, content: ["volumes"], ...ts(120 * D) },
  { id: "sp-nfs", name: "nfs-storage", driver: "nfs", nodeId: null, capacityGb: 8192, usedGb: 5640, content: ["volumes", "iso", "images"], ...ts(80 * D) },
  { id: "sp-bak", name: "backup-storage", driver: "s3", nodeId: null, capacityGb: 16384, usedGb: 9800, content: ["backups"], ...ts(80 * D) },
];

type Seed = [name: string, os: OsFamily, ver: string, status: InstanceStatus, cpu: number, memGb: number, disk: number, node: string, project: string];

const vmSeeds: Seed[] = [
  ["ubuntu-web-01", "ubuntu", "24.04", "running", 4, 8, 80, "n-01", "p-web"],
  ["ubuntu-web-02", "ubuntu", "24.04", "running", 4, 8, 80, "n-02", "p-web"],
  ["db-postgres-01", "debian", "12", "running", 8, 32, 500, "n-01", "p-web"],
  ["rocky-k8s-master", "rocky", "9.4", "running", 4, 16, 120, "n-02", "p-default"],
  ["rocky-k8s-worker-1", "rocky", "9.4", "running", 8, 16, 200, "n-02", "p-default"],
  ["rocky-k8s-worker-2", "rocky", "9.4", "running", 8, 16, 200, "n-03", "p-default"],
  ["win-ad-dc01", "windows", "Server 2022", "running", 4, 8, 120, "n-01", "p-default"],
  ["alma-mail-01", "alma", "9", "running", 2, 4, 60, "n-03", "p-default"],
  ["fedora-dev-box", "fedora", "40", "running", 4, 8, 100, "n-03", "p-lab"],
  ["lab-student-01", "ubuntu", "22.04", "running", 2, 2, 40, "n-02", "p-lab"],
  ["lab-student-02", "ubuntu", "22.04", "running", 2, 2, 40, "n-02", "p-lab"],
  ["gitlab-runner", "debian", "12", "running", 4, 8, 150, "n-01", "p-default"],
  ["win-11-test", "windows", "11 Pro", "stopped", 4, 8, 80, "n-03", "p-lab"],
  ["ubuntu-legacy", "ubuntu", "20.04", "stopped", 2, 4, 40, "n-01", "p-default"],
  ["pfsense-lab", "custom", "2.7", "stopped", 2, 2, 20, "n-02", "p-lab"],
];

const ctSeeds: Seed[] = [
  ["nginx-proxy", "alpine", "3.20", "running", 1, 0.5, 4, "n-01", "p-web"],
  ["redis-cache", "alpine", "3.20", "running", 2, 2, 8, "n-01", "p-web"],
  ["grafana", "debian", "12", "running", 1, 1, 10, "n-02", "p-default"],
  ["prometheus", "debian", "12", "running", 2, 4, 100, "n-02", "p-default"],
  ["loki", "debian", "12", "running", 2, 2, 50, "n-02", "p-default"],
  ["dns-01", "alpine", "3.20", "running", 1, 0.5, 2, "n-01", "p-default"],
  ["dns-02", "alpine", "3.20", "running", 1, 0.5, 2, "n-03", "p-default"],
  ["api-gateway", "ubuntu", "24.04", "running", 2, 2, 10, "n-01", "p-web"],
  ["worker-queue", "ubuntu", "24.04", "running", 2, 4, 20, "n-03", "p-web"],
  ["minio", "debian", "12", "running", 2, 4, 20, "n-02", "p-default"],
  ["vault", "alpine", "3.20", "running", 1, 1, 5, "n-01", "p-default"],
  ["jupyter-lab", "ubuntu", "22.04", "running", 4, 8, 40, "n-03", "p-lab"],
  ["student-ct-01", "ubuntu", "22.04", "running", 1, 1, 8, "n-02", "p-lab"],
  ["student-ct-02", "ubuntu", "22.04", "running", 1, 1, 8, "n-02", "p-lab"],
  ["student-ct-03", "ubuntu", "22.04", "running", 1, 1, 8, "n-03", "p-lab"],
  ["ci-cache", "debian", "12", "running", 2, 2, 60, "n-01", "p-default"],
  ["mqtt-broker", "alpine", "3.20", "running", 1, 0.5, 2, "n-03", "p-default"],
  ["uptime-kuma", "debian", "12", "running", 1, 1, 5, "n-02", "p-default"],
  ["old-wiki", "debian", "11", "stopped", 1, 1, 10, "n-01", "p-default"],
  ["test-php", "ubuntu", "20.04", "stopped", 1, 1, 8, "n-03", "p-lab"],
];

function buildInstances(seeds: Seed[], type: "vm" | "container"): Instance[] {
  const rnd = seeded(type === "vm" ? 7 : 13);
  return seeds.map(([name, family, version, status, cpu, memGb, disk, nodeId, projectId], i) => {
    const running = status === "running";
    const net = projectId === "p-web" ? "net-web" : projectId === "p-lab" ? "net-lab" : "net-lan";
    const prefix = net === "net-web" ? "10.20.0" : net === "net-lab" ? "172.16.50" : "10.10.0";
    const age = Math.floor(rnd() * 200 + 3) * D;
    return {
      id: `${type === "vm" ? "vm" : "ct"}-${String(i + 1).padStart(3, "0")}`,
      type,
      name,
      status,
      nodeId,
      projectId,
      ownerId: i % 4 === 0 ? "u-somchai" : "u-admin",
      os: { family, version },
      cpuCores: cpu,
      memoryMb: Math.round(memGb * 1024),
      diskGb: disk,
      ipv4: running ? `${prefix}.${(type === "vm" ? 20 : 120) + i}` : null,
      macAddress: `52:54:00:${[i, Math.floor(rnd() * 255), Math.floor(rnd() * 255)].map((n) => n.toString(16).padStart(2, "0")).join(":")}`,
      uptimeSeconds: running ? Math.floor(rnd() * 40 * 86400) : 0,
      cpuUsage: running ? Math.round(rnd() * 85 + 3) : 0,
      memoryUsage: running ? Math.round(rnd() * 70 + 20) : 0,
      provider: "mock",
      networkId: net,
      storagePoolId: type === "vm" ? "sp-zfs" : "sp-local",
      createdAt: iso(age),
      updatedAt: iso(age / 3),
      createdBy: "u-admin",
    };
  });
}

export const seedInstances: Instance[] = [...buildInstances(vmSeeds, "vm"), ...buildInstances(ctSeeds, "container")];

export const volumes: Volume[] = seedInstances
  .filter((i) => i.type === "vm")
  .slice(0, 10)
  .map((vm, idx): Volume => ({ id: `vol-${idx + 1}`, name: `${vm.name}-disk0`, poolId: vm.storagePoolId, sizeGb: vm.diskGb, attachedTo: vm.id, type: idx % 3 === 0 ? "nvme" : "ssd" }))
  .concat([{ id: "vol-99", name: "scratch-data", poolId: "sp-nfs", sizeGb: 250, attachedTo: null, type: "hdd" }]);

export const seedSnapshots: Snapshot[] = [
  { id: "snap-001", instanceId: "vm-001", name: "before-upgrade", description: "Pre apt dist-upgrade", sizeGb: 4.2, createdAt: iso(9 * D), includesMemory: false },
  { id: "snap-002", instanceId: "vm-001", name: "nginx-configured", sizeGb: 1.1, createdAt: iso(4 * D), includesMemory: false },
  { id: "snap-003", instanceId: "vm-001", name: "daily-auto", sizeGb: 0.6, createdAt: iso(6 * H), includesMemory: true },
  { id: "snap-004", instanceId: "vm-003", name: "pg-16-migration", sizeGb: 22.5, createdAt: iso(2 * D), includesMemory: false },
];

export const firewallRules: FirewallRule[] = [
  { id: "fw-1", scope: "global", targetId: null, direction: "in", protocol: "tcp", source: "0.0.0.0/0", destination: "any", port: "22", action: "drop", priority: 100, comment: "Block public SSH" },
  { id: "fw-2", scope: "global", targetId: null, direction: "in", protocol: "tcp", source: "10.0.0.0/8", destination: "any", port: "22", action: "allow", priority: 90, comment: "SSH from internal" },
  { id: "fw-3", scope: "vm", targetId: "vm-001", direction: "in", protocol: "tcp", source: "any", destination: "10.20.0.20", port: "80,443", action: "allow", priority: 50 },
  { id: "fw-4", scope: "node", targetId: "n-03", direction: "in", protocol: "icmp", source: "any", destination: "any", port: "-", action: "allow", priority: 10 },
  { id: "fw-5", scope: "container", targetId: "ct-002", direction: "in", protocol: "tcp", source: "10.20.0.0/24", destination: "any", port: "6379", action: "allow", priority: 40 },
  { id: "fw-6", scope: "global", targetId: null, direction: "in", protocol: "udp", source: "any", destination: "any", port: "161", action: "reject", priority: 80, comment: "No SNMP" },
];

export const users: User[] = [
  { id: "u-admin", name: "Admin", email: "admin@openlab.local", role: "Super Admin", status: "active", lastLoginAt: iso(0.2 * H), teams: ["platform"], ...ts(200 * D) },
  { id: "u-somchai", name: "Somchai P.", email: "somchai@openlab.local", role: "Infrastructure Admin", status: "active", lastLoginAt: iso(3 * H), teams: ["platform", "network"], ...ts(150 * D) },
  { id: "u-nattaya", name: "Nattaya K.", email: "nattaya@openlab.local", role: "Operator", status: "active", lastLoginAt: iso(1 * D), teams: ["noc"], ...ts(100 * D) },
  { id: "u-dev1", name: "Krit S.", email: "krit@openlab.local", role: "Developer", status: "active", lastLoginAt: iso(2 * D), teams: ["web"], ...ts(60 * D) },
  { id: "u-dev2", name: "Ploy W.", email: "ploy@openlab.local", role: "Developer", status: "invited", lastLoginAt: null, teams: ["web"], ...ts(2 * D) },
  { id: "u-view", name: "Auditor", email: "audit@openlab.local", role: "Viewer", status: "disabled", lastLoginAt: iso(40 * D), teams: [], ...ts(300 * D) },
];

export const seedAuditLogs: AuditLog[] = [
  { id: "a-1", user: "admin", action: "Created VM", resource: "ubuntu-web-02", ipAddress: "10.0.0.25", result: "success", timestamp: iso(12 * 60_000) },
  { id: "a-2", user: "somchai", action: "Started container", resource: "redis-cache", ipAddress: "10.0.0.41", result: "success", timestamp: iso(38 * 60_000) },
  { id: "a-3", user: "admin", action: "Deleted snapshot", resource: "snapshot-003", ipAddress: "10.0.0.25", result: "success", timestamp: iso(1.5 * H) },
  { id: "a-4", user: "krit", action: "Stopped VM", resource: "win-11-test", ipAddress: "10.0.0.77", result: "success", timestamp: iso(3 * H) },
  { id: "a-5", user: "ploy", action: "Created VM", resource: "big-gpu-box", ipAddress: "10.0.0.78", result: "failure", timestamp: iso(5 * H) },
  { id: "a-6", user: "nattaya", action: "Updated firewall rule", resource: "fw-2", ipAddress: "10.0.0.52", result: "success", timestamp: iso(8 * H) },
  { id: "a-7", user: "admin", action: "Added node", resource: "node-03", ipAddress: "10.0.0.25", result: "success", timestamp: iso(2 * D) },
];

export const alerts: Alert[] = [
  { id: "al-1", severity: "warning", kind: "high_cpu", message: "CPU above 80% for 15 minutes", resource: "node-03", createdAt: iso(20 * 60_000) },
  { id: "al-2", severity: "critical", kind: "vm_down", message: "Guest agent not responding", resource: "pfsense-lab", createdAt: iso(2 * H) },
  { id: "al-3", severity: "warning", kind: "disk_full", message: "Storage pool 73% used", resource: "local-zfs", createdAt: iso(6 * H) },
];

const RANGE_MS: Record<TimeRange, { span: number; points: number }> = {
  "1h": { span: H, points: 60 },
  "6h": { span: 6 * H, points: 72 },
  "24h": { span: D, points: 96 },
  "7d": { span: 7 * D, points: 84 },
  "30d": { span: 30 * D, points: 90 },
};

/** Synthetic time-series, deterministic per (seed, range). */
export function generateMetrics(range: TimeRange, seed = 1, base = { cpu: 43, memory: 62, storage: 71 }): MetricPoint[] {
  const { span, points } = RANGE_MS[range];
  const rnd = seeded(seed * 97 + points);
  const step = span / points;
  const out: MetricPoint[] = [];
  for (let i = 0; i <= points; i++) {
    const wave = Math.sin((i / points) * Math.PI * 4);
    const clamp = (v: number) => Math.max(1, Math.min(99, v));
    out.push({
      t: NOW - span + i * step,
      cpu: clamp(base.cpu + wave * 12 + (rnd() - 0.5) * 14),
      memory: clamp(base.memory + wave * 4 + (rnd() - 0.5) * 5),
      storage: clamp(base.storage - 3 + (i / points) * 3 + (rnd() - 0.5) * 0.6),
      netIn: Math.max(5, 420 + wave * 180 + (rnd() - 0.5) * 160),
      netOut: Math.max(5, 260 + wave * 110 + (rnd() - 0.5) * 120),
    });
  }
  return out;
}
