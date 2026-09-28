import "server-only";
import type { Prisma } from "@prisma/client";
import type { ProvisionSpec } from "@/lib/providers";
import type { PowerAction, QuotaUsage } from "@/lib/types";
import type { CreateInstanceInput } from "@/lib/validation/instance";
import { assertPermission, AuthError, visibleProjectIds, type Principal } from "./auth";
import { db } from "./db";
import { enqueueJob } from "./jobs";
import { toInstance, toJob } from "./mappers";

/**
 * Instance service = business logic (tenancy, RBAC, quota, job orchestration).
 * It never talks to a hypervisor; the worker does that via the provider layer.
 */
export class ServiceError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export interface Ctx {
  principal: Principal;
  ip: string;
}

const DEFAULT_QUOTA = { maxInstances: 60, maxCpuCores: 256, maxMemoryMb: 512 * 1024, maxStorageGb: 8000 };

function projectScope(p: Principal): Prisma.InstanceWhereInput {
  const ids = visibleProjectIds(p);
  return ids === null ? {} : { projectId: { in: ids } };
}

async function usage(tx: Prisma.TransactionClient, where: Prisma.InstanceWhereInput) {
  const a = await tx.instance.aggregate({ where: { ...where, deletedAt: null }, _count: true, _sum: { cpuCores: true, memoryMb: true, diskGb: true } });
  return { instances: a._count, cpuCores: a._sum.cpuCores ?? 0, memoryMb: a._sum.memoryMb ?? 0, storageGb: a._sum.diskGb ?? 0 };
}

export async function quotaUsage(projectId: string, tx: Prisma.TransactionClient = db): Promise<QuotaUsage> {
  const q = (await tx.resourceQuota.findUnique({ where: { scope_scopeId: { scope: "PROJECT", scopeId: projectId } } })) ?? DEFAULT_QUOTA;
  const u = await usage(tx, { projectId });
  return {
    quota: { scope: "project", scopeId: projectId, maxInstances: q.maxInstances, maxCpuCores: q.maxCpuCores, maxMemoryGb: Math.round(q.maxMemoryMb / 1024), maxStorageGb: q.maxStorageGb },
    used: { instances: u.instances, cpuCores: u.cpuCores, memoryGb: Math.round(u.memoryMb / 1024), storageGb: u.storageGb },
  };
}

/**
 * Checks project + user quotas inside the caller's transaction. A per-project
 * advisory lock serialises concurrent provisioning so two requests can't both
 * squeeze under the limit.
 */
async function assertQuota(tx: Prisma.TransactionClient, projectId: string, ownerId: string, add: { cpuCores: number; memoryMb: number; diskGb: number }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`;
  const scopes: Array<{ label: string; quota: typeof DEFAULT_QUOTA | null; where: Prisma.InstanceWhereInput }> = [
    { label: "Project", quota: (await tx.resourceQuota.findUnique({ where: { scope_scopeId: { scope: "PROJECT", scopeId: projectId } } })) ?? DEFAULT_QUOTA, where: { projectId } },
    { label: "User", quota: await tx.resourceQuota.findUnique({ where: { scope_scopeId: { scope: "USER", scopeId: ownerId } } }), where: { ownerId } },
  ];
  for (const s of scopes) {
    if (!s.quota) continue;
    const u = await usage(tx, s.where);
    const over: string[] = [];
    if (u.instances + 1 > s.quota.maxInstances) over.push(`instances (${s.quota.maxInstances} max)`);
    if (u.cpuCores + add.cpuCores > s.quota.maxCpuCores) over.push(`CPU (${s.quota.maxCpuCores} cores max)`);
    if (u.memoryMb + add.memoryMb > s.quota.maxMemoryMb) over.push(`memory (${Math.round(s.quota.maxMemoryMb / 1024)} GB max)`);
    if (u.storageGb + add.diskGb > s.quota.maxStorageGb) over.push(`storage (${s.quota.maxStorageGb} GB max)`);
    if (over.length) throw new ServiceError("QUOTA_EXCEEDED", `${s.label} quota exceeded: ${over.join(", ")}`, 409);
  }
}

async function findVisible(ctx: Ctx, id: string) {
  const inst = await db.instance.findFirst({ where: { id, deletedAt: null, ...projectScope(ctx.principal) }, include: { node: true } });
  if (!inst) throw new ServiceError("NOT_FOUND", "Instance not found", 404);
  return inst;
}

const managePerm = (type: "VM" | "CONTAINER", vmPerm: "vm.start" | "vm.stop" | "vm.delete" | "vm.create") =>
  type === "CONTAINER" ? ("container.manage" as const) : vmPerm;

export async function listInstances(ctx: Ctx, type?: "vm" | "container") {
  const rows = await db.instance.findMany({
    where: { deletedAt: null, ...projectScope(ctx.principal), ...(type ? { type: type === "vm" ? "VM" : "CONTAINER" } : {}) },
    orderBy: { name: "asc" },
    include: { node: { select: { provider: true } } },
  });
  return rows.map((r) => toInstance(r, r.node.provider.toLowerCase() as "mock"));
}

export async function getInstance(ctx: Ctx, id: string) {
  const r = await findVisible(ctx, id);
  return toInstance(r, r.node.provider.toLowerCase() as "mock");
}

export async function createInstance(ctx: Ctx, input: CreateInstanceInput) {
  const type = input.type === "vm" ? "VM" : "CONTAINER";
  assertPermission(ctx.principal, managePerm(type, "vm.create"), input.projectId);

  const [node, network, pool] = await Promise.all([
    db.node.findFirst({ where: { id: input.nodeId, deletedAt: null } }),
    db.network.findFirst({ where: { id: input.networkId, deletedAt: null }, include: { subnets: true } }),
    db.storagePool.findFirst({ where: { id: input.storagePoolId, deletedAt: null } }),
  ]);
  if (!node) throw new ServiceError("INVALID_NODE", "Selected node does not exist");
  if (node.status !== "ONLINE") throw new ServiceError("NODE_OFFLINE", `${node.name} is ${node.status.toLowerCase()} — pick another node`, 409);
  if (!network || (network.projectId && network.projectId !== input.projectId)) throw new ServiceError("INVALID_NETWORK", "Selected network is not available to this project");
  if (!pool) throw new ServiceError("INVALID_POOL", "Selected storage pool does not exist");

  const v4 = network.subnets.find((s) => s.ipVersion === 4);
  const spec: ProvisionSpec = {
    type: input.type,
    name: input.name,
    os: { family: input.os.family, version: input.os.version },
    cpuCores: input.cpuCores,
    memoryMb: input.memoryMb,
    diskGb: input.diskGb,
    diskType: input.diskType,
    storagePool: pool.name,
    network: { bridge: network.bridge, vlanId: input.vlanId, ipMode: input.ipMode, staticIp: input.staticIp, gateway: v4?.gateway ?? undefined, dns: network.dns },
    firewallEnabled: input.firewallEnabled,
    sshKey: input.sshKey || undefined,
    cloudInit: input.cloudInit,
  };

  const inst = await db.$transaction(async (tx) => {
    if (await tx.instance.findFirst({ where: { projectId: input.projectId, name: input.name, deletedAt: null } })) {
      throw new ServiceError("NAME_TAKEN", `An instance named "${input.name}" already exists in this project`, 409);
    }
    await assertQuota(tx, input.projectId, ctx.principal.userId, input);
    return tx.instance.create({
      data: {
        type,
        name: input.name,
        description: input.description || null,
        projectId: input.projectId,
        nodeId: node.id,
        ownerId: ctx.principal.userId,
        status: "STARTING",
        osFamily: input.os.family,
        osVersion: input.os.version,
        cpuCores: input.cpuCores,
        memoryMb: input.memoryMb,
        diskGb: input.diskGb,
        networkId: network.id,
        storagePoolId: pool.id,
        macAddress: "pending",
        cloudInit: input.cloudInit,
        createdBy: ctx.principal.userId,
      },
    });
  });

  const label = input.type === "vm" ? "VM" : "container";
  const job = await enqueueJob(
    { kind: "vm.create", instanceId: inst.id, spec: spec as unknown as Prisma.JsonObject },
    {
      actorId: ctx.principal.userId, ip: ctx.ip, resourceName: inst.name, resourceId: inst.id, projectId: inst.projectId,
      steps: [`Creating ${label}...`, "Allocating storage...", "Configuring network...", "Installing OS...", `Starting ${label}...`],
    },
  );
  return toJob(job);
}

export async function powerAction(ctx: Ctx, id: string, action: PowerAction) {
  const inst = await findVisible(ctx, id);
  assertPermission(ctx.principal, managePerm(inst.type, action === "start" ? "vm.start" : "vm.stop"), inst.projectId);
  if (action === "restart") assertPermission(ctx.principal, managePerm(inst.type, "vm.start"), inst.projectId);
  const wantsRunning = action === "start";
  if (inst.status === "STARTING" || inst.status === "STOPPING") throw new ServiceError("BUSY", `${inst.name} is busy (${inst.status.toLowerCase()})`, 409);
  if (wantsRunning && inst.status === "RUNNING") throw new ServiceError("INVALID_STATE", `${inst.name} is already running`, 409);
  if (!wantsRunning && inst.status === "STOPPED") throw new ServiceError("INVALID_STATE", `${inst.name} is already stopped`, 409);

  await db.instance.update({ where: { id }, data: { status: wantsRunning ? "STARTING" : "STOPPING" } });
  const verb = { start: "Starting", stop: "Stopping", restart: "Restarting", shutdown: "Shutting down" }[action];
  return toJob(
    await enqueueJob({ kind: "vm.power", instanceId: id, action }, { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: inst.name, resourceId: id, projectId: inst.projectId, steps: [`${verb} ${inst.name}...`] }),
  );
}

export async function deleteInstance(ctx: Ctx, id: string) {
  const inst = await findVisible(ctx, id);
  assertPermission(ctx.principal, managePerm(inst.type, "vm.delete"), inst.projectId);
  await db.instance.update({ where: { id }, data: { status: "STOPPING" } });
  return toJob(
    await enqueueJob({ kind: "vm.delete", instanceId: id }, { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: inst.name, resourceId: id, projectId: inst.projectId, steps: [`Deleting ${inst.name}...`] }),
  );
}

export async function cloneInstance(ctx: Ctx, id: string, name: string) {
  const src = await findVisible(ctx, id);
  assertPermission(ctx.principal, managePerm(src.type, "vm.create"), src.projectId);
  const clone = await db.$transaction(async (tx) => {
    if (await tx.instance.findFirst({ where: { projectId: src.projectId, name, deletedAt: null } })) throw new ServiceError("NAME_TAKEN", `"${name}" already exists in this project`, 409);
    await assertQuota(tx, src.projectId, ctx.principal.userId, src);
    const { id: _id, createdAt: _c, updatedAt: _u, providerRef: _r, startedAt: _s, ipv4: _ip, node: _n, ...rest } = src;
    return tx.instance.create({ data: { ...rest, name, status: "STARTING", ownerId: ctx.principal.userId, createdBy: ctx.principal.userId, macAddress: "pending" } });
  });
  return toJob(
    await enqueueJob({ kind: "vm.clone", sourceId: src.id, instanceId: clone.id }, { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: name, resourceId: clone.id, projectId: src.projectId, steps: [`Cloning ${src.name} → ${name}...`] }),
  );
}

export async function resizeInstance(ctx: Ctx, id: string, res: { cpuCores: number; memoryMb: number }) {
  const inst = await findVisible(ctx, id);
  assertPermission(ctx.principal, managePerm(inst.type, "vm.create"), inst.projectId);
  if (inst.type === "VM" && inst.status !== "STOPPED" && (res.cpuCores < inst.cpuCores || res.memoryMb < inst.memoryMb)) {
    throw new ServiceError("REQUIRES_STOP", "Stop the VM before reducing CPU or memory", 409);
  }
  await db.$transaction((tx) => assertQuota(tx, inst.projectId, inst.ownerId, { cpuCores: res.cpuCores - inst.cpuCores, memoryMb: res.memoryMb - inst.memoryMb, diskGb: 0 }));
  return toJob(
    await enqueueJob({ kind: "vm.resize", instanceId: id, ...res }, { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: inst.name, resourceId: id, projectId: inst.projectId, steps: [`Resizing ${inst.name}...`] }),
  );
}

export async function listSnapshots(ctx: Ctx, instanceId: string) {
  await findVisible(ctx, instanceId);
  return db.snapshot.findMany({ where: { instanceId, deletedAt: null }, orderBy: { createdAt: "asc" } });
}

export async function snapshotInstance(ctx: Ctx, id: string, name: string, includeMemory: boolean) {
  const inst = await findVisible(ctx, id);
  assertPermission(ctx.principal, managePerm(inst.type, "vm.stop"), inst.projectId);
  if (await db.snapshot.findFirst({ where: { instanceId: id, name, deletedAt: null } })) throw new ServiceError("NAME_TAKEN", `Snapshot "${name}" already exists`, 409);
  return toJob(
    await enqueueJob({ kind: "snapshot.create", instanceId: id, name, includeMemory }, { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: name, resourceId: id, projectId: inst.projectId, steps: [`Creating snapshot ${name}...`] }),
  );
}

export async function snapshotAction(ctx: Ctx, instanceId: string, snapshotId: string, action: "restore" | "delete") {
  const inst = await findVisible(ctx, instanceId);
  assertPermission(ctx.principal, managePerm(inst.type, action === "delete" ? "vm.delete" : "vm.stop"), inst.projectId);
  const snap = await db.snapshot.findFirst({ where: { id: snapshotId, instanceId, deletedAt: null } });
  if (!snap) throw new ServiceError("NOT_FOUND", "Snapshot not found", 404);
  return toJob(
    await enqueueJob(
      { kind: action === "delete" ? "snapshot.delete" : "snapshot.restore", snapshotId },
      { actorId: ctx.principal.userId, ip: ctx.ip, resourceName: snap.name, resourceId: instanceId, projectId: inst.projectId, steps: [`${action === "delete" ? "Deleting" : "Restoring"} snapshot ${snap.name}...`] },
    ),
  );
}

export async function getJobFor(ctx: Ctx, id: string) {
  const job = await db.job.findUnique({ where: { id } });
  const ids = visibleProjectIds(ctx.principal);
  if (!job || (job.createdBy !== ctx.principal.userId && ids !== null && (!job.projectId || !ids.includes(job.projectId)))) {
    throw new ServiceError("NOT_FOUND", "Job not found", 404);
  }
  return toJob(job);
}

export { AuthError };
