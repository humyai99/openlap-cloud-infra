/**
 * Seeds a demo installation: org, projects, RBAC, users, cluster, nodes,
 * networks, storage and the Phase 1 sample instances.
 *   npm run db:seed          (idempotent: skips if the organization already exists)
 * Admin: admin@openlab.local / $SEED_ADMIN_PASSWORD (see .env)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { firewallRules, networks, nodes, projects, seedAuditLogs, seedInstances, seedSnapshots, storagePools, users } from "../src/lib/mock/data";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/rbac";
import { hashPassword, randomToken } from "../src/lib/server/crypto";

const db = new PrismaClient();
const id = new Map<string, string>(); // mock id → uuid
const uid = (mockId: string) => id.get(mockId) ?? id.set(mockId, crypto.randomUUID()).get(mockId)!;

async function main() {
  if (await db.organization.findUnique({ where: { slug: "default" } })) {
    console.log("Seed skipped: organization 'default' already exists.");
    return;
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) throw new Error("Set SEED_ADMIN_PASSWORD (8+ chars) in .env");

  const org = await db.organization.create({ data: { name: "OpenLab", slug: "default" } });
  for (const p of projects) await db.project.create({ data: { id: uid(p.id), name: p.name, organizationId: org.id } });

  // RBAC: permissions + built-in roles
  for (const p of PERMISSIONS) await db.permission.create({ data: { key: p.key, description: p.label } });
  const perms = new Map((await db.permission.findMany()).map((p) => [p.key, p.id]));
  const roleIds = new Map<string, string>();
  for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const r = await db.role.create({
      data: { name, builtIn: true, permissions: { create: keys.map((k) => ({ permissionId: perms.get(k)! })) } },
    });
    roleIds.set(name, r.id);
  }

  // Users. Only the admin gets a usable password; the others get random ones (reset via admin later).
  const teams = new Map<string, string>();
  for (const u of users) {
    const pw = u.id === "u-admin" ? adminPassword : randomToken(24);
    await db.user.create({
      data: {
        id: uid(u.id),
        email: u.email,
        name: u.name,
        passwordHash: await hashPassword(pw),
        status: u.status.toUpperCase() as "ACTIVE",
        userRoles: {
          create:
            u.role === "Developer"
              ? [{ roleId: roleIds.get("Developer")!, projectId: uid("p-web") }] // project-scoped binding
              : [{ roleId: roleIds.get(u.role)! }],
        },
      },
    });
    for (const t of u.teams) {
      if (!teams.has(t)) teams.set(t, (await db.team.create({ data: { name: t, organizationId: org.id } })).id);
      await db.teamMember.create({ data: { teamId: teams.get(t)!, userId: uid(u.id) } });
    }
  }
  const admin = uid("u-admin");

  const cluster = await db.cluster.create({ data: { name: "main", createdBy: admin } });
  for (const n of nodes) {
    await db.node.create({
      data: {
        id: uid(n.id), clusterId: cluster.id, name: n.name, address: n.address, provider: "MOCK", status: "ONLINE",
        cpuModel: n.cpuModel, cpuCores: n.cpuCores, memoryMb: BigInt(n.memoryGb * 1024), lastSeenAt: new Date(), createdBy: admin,
      },
    });
  }
  for (const n of networks) {
    await db.network.create({
      data: {
        id: uid(n.id), name: n.name, type: n.type.toUpperCase() as "BRIDGE", bridge: n.bridge, vlanId: n.vlanId, dns: n.dns, createdBy: admin,
        subnets: {
          create: [
            { cidr: n.cidr, ipVersion: 4, gateway: n.gateway, dhcpStart: n.dhcp?.start, dhcpEnd: n.dhcp?.end, createdBy: admin },
            ...(n.ipv6Cidr ? [{ cidr: n.ipv6Cidr, ipVersion: 6, createdBy: admin }] : []),
          ],
        },
      },
    });
  }
  for (const p of storagePools) {
    await db.storagePool.create({
      data: { id: uid(p.id), name: p.name, driver: p.driver, nodeId: p.nodeId ? uid(p.nodeId) : null, config: {}, capacityGb: BigInt(p.capacityGb), content: p.content, createdBy: admin },
    });
  }

  for (const i of seedInstances) {
    const running = i.status === "running";
    await db.instance.create({
      data: {
        id: uid(i.id), type: i.type === "vm" ? "VM" : "CONTAINER", name: i.name, projectId: uid(i.projectId), nodeId: uid(i.nodeId), ownerId: uid(i.ownerId),
        providerRef: `mock-${i.name}`, status: i.status.toUpperCase() as "RUNNING", osFamily: i.os.family, osVersion: i.os.version,
        cpuCores: i.cpuCores, memoryMb: i.memoryMb, diskGb: i.diskGb, networkId: uid(i.networkId), storagePoolId: uid(i.storagePoolId),
        ipv4: i.ipv4, macAddress: i.macAddress, startedAt: running ? new Date(Date.now() - i.uptimeSeconds * 1000) : null,
        createdAt: new Date(i.createdAt), createdBy: admin,
      },
    });
  }
  for (const s of seedSnapshots) {
    await db.snapshot.create({
      data: { instanceId: uid(s.instanceId), name: s.name, description: s.description, sizeGb: s.sizeGb, includesMemory: s.includesMemory, createdAt: new Date(s.createdAt), createdBy: admin },
    });
  }
  for (const r of firewallRules) {
    await db.firewallRule.create({
      data: { scope: r.scope, targetId: r.targetId ? uid(r.targetId) : null, direction: r.direction, protocol: r.protocol, source: r.source, destination: r.destination, port: r.port, action: r.action, priority: r.priority, comment: r.comment, createdBy: admin },
    });
  }

  await db.resourceQuota.createMany({
    data: [
      { scope: "PROJECT", scopeId: uid("p-default"), maxInstances: 60, maxCpuCores: 256, maxMemoryMb: 512 * 1024, maxStorageGb: 8000, createdBy: admin },
      { scope: "PROJECT", scopeId: uid("p-web"), maxInstances: 20, maxCpuCores: 64, maxMemoryMb: 128 * 1024, maxStorageGb: 2000, createdBy: admin },
      { scope: "PROJECT", scopeId: uid("p-lab"), maxInstances: 30, maxCpuCores: 48, maxMemoryMb: 64 * 1024, maxStorageGb: 1000, createdBy: admin },
      { scope: "USER", scopeId: uid("u-dev1"), maxInstances: 10, maxCpuCores: 32, maxMemoryMb: 64 * 1024, maxStorageGb: 500, createdBy: admin },
    ],
  });

  const alertRows: Prisma.AlertCreateManyInput[] = [
    { severity: "warning", kind: "high_cpu", message: "CPU above 80% for 15 minutes", resourceType: "node", resourceId: uid("n-03"), resourceName: "node-03" },
    { severity: "warning", kind: "disk_full", message: "Storage pool above 70% used", resourceType: "storage_pool", resourceId: uid("sp-zfs"), resourceName: "local-zfs" },
  ];
  await db.alert.createMany({ data: alertRows });

  const byName = new Map(users.map((u) => [u.email.split("@")[0], uid(u.id)]));
  for (const a of seedAuditLogs) {
    await db.auditLog.create({
      data: { userId: byName.get(a.user) ?? null, action: a.action, resourceName: a.resource, ipAddress: a.ipAddress, result: a.result, createdAt: new Date(a.timestamp) },
    });
  }
  console.log(`Seeded: ${seedInstances.length} instances, ${nodes.length} nodes, ${users.length} users. Sign in as admin@openlab.local (password = SEED_ADMIN_PASSWORD in .env).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
