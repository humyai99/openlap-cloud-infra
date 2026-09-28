import type * as P from "@prisma/client";
import type { AuditLog, Instance, Job, JobStep, Network, Node, OsFamily, ProviderKind, RoleName, Snapshot, StoragePool, User } from "@/lib/types";

/** DB rows → public API types. Keeps the Phase 1 REST contract stable. */
const lc = <T extends string>(v: string) => v.toLowerCase() as T;

/**
 * Live CPU / RAM utilisation comes from Prometheus in Phase 3. Until then a
 * deterministic value derived from the id is shown (clearly marked "simulated" in the UI).
 */
export function simulatedUsage(id: string, salt: number) {
  let h = salt;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 3 + (h % 83);
}

export function toInstance(r: P.Instance, providerKind: ProviderKind = "mock"): Instance {
  const running = r.status === "RUNNING";
  return {
    id: r.id,
    type: r.type === "VM" ? "vm" : "container",
    name: r.name,
    description: r.description ?? undefined,
    status: lc(r.status),
    nodeId: r.nodeId,
    projectId: r.projectId,
    ownerId: r.ownerId,
    os: { family: r.osFamily as OsFamily, version: r.osVersion },
    cpuCores: r.cpuCores,
    memoryMb: r.memoryMb,
    diskGb: r.diskGb,
    ipv4: r.ipv4,
    macAddress: r.macAddress,
    uptimeSeconds: running && r.startedAt ? Math.floor((Date.now() - r.startedAt.getTime()) / 1000) : 0,
    cpuUsage: running ? simulatedUsage(r.id, 7) : 0,
    memoryUsage: running ? 15 + (simulatedUsage(r.id, 13) % 75) : 0,
    provider: providerKind,
    networkId: r.networkId,
    storagePoolId: r.storagePoolId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
  };
}

export function toNode(r: P.Node, alloc: { runningMemMb: number; storagePct: number }): Node {
  const memGb = Number(r.memoryMb) / 1024;
  return {
    id: r.id,
    name: r.name,
    status: lc(r.status),
    clusterId: r.clusterId,
    cpuModel: r.cpuModel ?? "Unknown CPU",
    cpuCores: r.cpuCores,
    memoryGb: Math.round(memGb),
    storageTb: 0,
    cpuUsage: r.status === "ONLINE" ? 25 + (simulatedUsage(r.id, 3) % 60) : 0,
    memoryUsage: Math.min(99, Math.round((alloc.runningMemMb / Number(r.memoryMb)) * 100)),
    storageUsage: alloc.storagePct,
    networkMbps: r.status === "ONLINE" ? 200 + (simulatedUsage(r.id, 5) % 700) : 0,
    provider: lc(r.provider),
    address: r.address,
    kernel: "6.8.0-45-generic",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
  };
}

export function toNetwork(r: P.Network & { subnets: P.Subnet[] }, connected: number): Network {
  const v4 = r.subnets.find((s) => s.ipVersion === 4);
  const v6 = r.subnets.find((s) => s.ipVersion === 6);
  return {
    id: r.id,
    name: r.name,
    type: lc(r.type),
    cidr: v4?.cidr ?? "—",
    ipv6Cidr: v6?.cidr ?? null,
    gateway: v4?.gateway ?? "—",
    vlanId: r.vlanId,
    bridge: r.bridge,
    dhcp: v4?.dhcpStart && v4.dhcpEnd ? { enabled: true, start: v4.dhcpStart, end: v4.dhcpEnd } : null,
    dns: r.dns,
    connectedInstances: connected,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
  };
}

export function toPool(r: P.StoragePool, usedGb: number): StoragePool {
  return {
    id: r.id,
    name: r.name,
    driver: r.driver as StoragePool["driver"],
    nodeId: r.nodeId,
    capacityGb: Number(r.capacityGb),
    usedGb,
    content: r.content as StoragePool["content"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
  };
}

export function toSnapshot(r: P.Snapshot): Snapshot {
  return {
    id: r.id,
    instanceId: r.instanceId,
    name: r.name,
    description: r.description ?? undefined,
    sizeGb: r.sizeGb ?? 0,
    createdAt: r.createdAt.toISOString(),
    includesMemory: r.includesMemory,
  };
}

export function toJob(r: P.Job): Job {
  return {
    id: r.id,
    kind: r.kind as Job["kind"],
    status: lc(r.status),
    progress: r.progress,
    steps: r.steps as unknown as JobStep[],
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

export function toAudit(r: P.AuditLog & { user: { email: string } | null }): AuditLog {
  return {
    id: r.id,
    user: r.user ? r.user.email.split("@")[0] : "system",
    action: r.action,
    resource: r.resourceName ?? r.resourceId ?? "—",
    ipAddress: r.ipAddress,
    result: r.result === "success" ? "success" : "failure",
    timestamp: r.createdAt.toISOString(),
  };
}

export function toUser(r: P.User & { userRoles: Array<{ role: { name: string } }>; teams: Array<{ team: { name: string } }> }): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: (r.userRoles[0]?.role.name ?? "Viewer") as RoleName,
    status: lc(r.status),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    teams: r.teams.map((t) => t.team.name),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
  };
}
