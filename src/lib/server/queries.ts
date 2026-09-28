import "server-only";
import type { Alert, FirewallRule, Instance, Project, Volume } from "@/lib/types";
import { visibleProjectIds, type Principal } from "./auth";
import { db } from "./db";
import { toAudit, toInstance, toNetwork, toNode, toPool, toUser } from "./mappers";

/** Read models for Server Components. Tenant-scoped where a principal is passed. */
async function poolUsage() {
  const rows = await db.instance.groupBy({ by: ["storagePoolId"], where: { deletedAt: null }, _sum: { diskGb: true } });
  return new Map(rows.map((r) => [r.storagePoolId, r._sum.diskGb ?? 0]));
}

export const queries = {
  async nodes() {
    const [nodes, running, pools, used] = await Promise.all([
      db.node.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
      db.instance.groupBy({ by: ["nodeId"], where: { deletedAt: null, status: "RUNNING" }, _sum: { memoryMb: true } }),
      db.storagePool.findMany({ where: { deletedAt: null } }),
      poolUsage(),
    ]);
    const mem = new Map(running.map((r) => [r.nodeId, r._sum.memoryMb ?? 0]));
    return nodes.map((n) => {
      const local = pools.filter((p) => p.nodeId === n.id);
      const cap = local.reduce((a, p) => a + Number(p.capacityGb), 0);
      const u = local.reduce((a, p) => a + (used.get(p.id) ?? 0), 0);
      return { ...toNode(n, { runningMemMb: mem.get(n.id) ?? 0, storagePct: cap ? Math.round((u / cap) * 100) : 0 }), storageTb: Math.max(1, Math.round(cap / 1024)) };
    });
  },

  async node(id: string) {
    return (await this.nodes()).find((n) => n.id === id || n.name === id) ?? null;
  },

  async projects(p?: Principal): Promise<Project[]> {
    const ids = p ? visibleProjectIds(p) : null;
    const rows = await db.project.findMany({ where: { deletedAt: null, ...(ids ? { id: { in: ids } } : {}) }, orderBy: { name: "asc" } });
    return rows.map((r) => ({ id: r.id, name: r.name, organizationId: r.organizationId }));
  },

  async instances(p: Principal, where: { nodeId?: string } = {}): Promise<Instance[]> {
    const ids = visibleProjectIds(p);
    const rows = await db.instance.findMany({ where: { deletedAt: null, ...where, ...(ids ? { projectId: { in: ids } } : {}) }, orderBy: { name: "asc" } });
    return rows.map((r) => toInstance(r));
  },

  async networks() {
    const [rows, counts] = await Promise.all([
      db.network.findMany({ where: { deletedAt: null }, include: { subnets: true }, orderBy: { name: "asc" } }),
      db.instance.groupBy({ by: ["networkId"], where: { deletedAt: null }, _count: true }),
    ]);
    const c = new Map(counts.map((r) => [r.networkId, r._count]));
    return rows.map((n) => toNetwork(n, c.get(n.id) ?? 0));
  },

  async storagePools() {
    const [rows, used] = await Promise.all([db.storagePool.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }), poolUsage()]);
    return rows.map((p) => toPool(p, used.get(p.id) ?? Math.round(Number(p.capacityGb) * 0.1)));
  },

  async volumes(): Promise<Volume[]> {
    const rows = await db.volume.findMany({ where: { deletedAt: null }, include: { vmDisk: true }, orderBy: { name: "asc" } });
    return rows.map((v) => ({ id: v.id, name: v.name, poolId: v.poolId, sizeGb: v.sizeGb, attachedTo: v.vmDisk?.instanceId ?? null, type: v.type as Volume["type"] }));
  },

  async firewallRules(): Promise<FirewallRule[]> {
    const rows = await db.firewallRule.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } });
    return rows.map((r) => ({
      id: r.id, scope: r.scope as FirewallRule["scope"], targetId: r.targetId, direction: r.direction as "in", protocol: r.protocol as "tcp",
      source: r.source, destination: r.destination, port: r.port ?? "-", action: r.action as "allow", priority: r.priority, comment: r.comment ?? undefined,
    }));
  },

  async users() {
    const rows = await db.user.findMany({
      where: { deletedAt: null },
      include: { userRoles: { include: { role: true, project: true } }, teams: { include: { team: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toUser);
  },

  async alerts(): Promise<Alert[]> {
    const rows = await db.alert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((a) => ({ id: a.id, severity: a.severity as Alert["severity"], kind: a.kind as Alert["kind"], message: a.message, resource: a.resourceName, createdAt: a.createdAt.toISOString() }));
  },

  async auditLogs(take = 100) {
    const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: { select: { email: true } } } });
    return rows.map(toAudit);
  },
};
