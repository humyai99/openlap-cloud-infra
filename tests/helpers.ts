import { loadPrincipal, type Principal } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { Ctx } from "@/lib/server/instances";
import type { Permission } from "@/lib/types";
import type { CreateInstanceInput } from "@/lib/validation/instance";

/** Principal for a seeded user, loaded exactly as a real request would. */
export async function ctxFor(email: string): Promise<Ctx> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const principal = await loadPrincipal(u.id, "session", null);
  if (!principal) throw new Error(`${email} is not active`);
  return { principal, ip: "127.0.0.1" };
}

/** Hand-built principal for pure permission tests (no DB). */
export function fakePrincipal(opts: { global?: Permission[]; projects?: Record<string, Permission[]>; scopes?: string[] }): Principal {
  return {
    userId: "u-test",
    email: "t@test",
    name: "Test",
    via: opts.scopes ? "api_key" : "session",
    mustChangePassword: false,
    global: new Set(opts.global ?? []),
    byProject: new Map(Object.entries(opts.projects ?? {}).map(([k, v]) => [k, new Set(v)])),
    scopes: opts.scopes ? new Set(opts.scopes) : null,
  };
}

export async function project(name: string) {
  return db.project.findFirstOrThrow({ where: { name } });
}

let seq = 0;
export const uniqueName = (prefix = "t") => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** A valid create-VM request for the given project (uses an existing node / network / pool). */
export async function vmSpec(projectName: string, over: Partial<CreateInstanceInput> = {}): Promise<CreateInstanceInput> {
  const p = await project(projectName);
  const [node, network, pool] = await Promise.all([
    db.node.findFirstOrThrow({ where: { status: "ONLINE" } }),
    db.network.findFirstOrThrow({ where: { name: "lan-default" } }),
    db.storagePool.findFirstOrThrow({ where: { name: "local-zfs" } }),
  ]);
  return {
    type: "vm",
    name: uniqueName("vm"),
    projectId: p.id,
    nodeId: node.id,
    os: { family: "ubuntu", version: "24.04 LTS" },
    cpuCores: 1,
    memoryMb: 1024,
    diskGb: 10,
    diskType: "ssd",
    storagePoolId: pool.id,
    networkId: network.id,
    vlanId: null,
    ipMode: "dhcp",
    firewallEnabled: true,
    sshKey: "",
    ...over,
  };
}

/** Current CPU usage of a project (non-deleted instances). */
export async function projectCpu(projectId: string) {
  const a = await db.instance.aggregate({ where: { projectId, deletedAt: null }, _sum: { cpuCores: true } });
  return a._sum.cpuCores ?? 0;
}
