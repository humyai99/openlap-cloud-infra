import "server-only";
import type { Prisma } from "@prisma/client";
import type { Permission } from "@/lib/types";
import { cookies } from "next/headers";
import { assertPermission, AuthError, SESSION_COOKIE, type Principal } from "./auth";
import { audit } from "./audit";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";
import { db } from "./db";
import { ServiceError, type Ctx } from "./instances";

/**
 * Identity administration: users, role bindings, custom roles and quotas.
 *
 * Anti-escalation rule: an admin can only grant (or build a role from)
 * permissions they hold organization-wide themselves. So a user with
 * `user.manage` but without `node.manage` cannot hand out `node.manage`.
 */
function assertCanGrant(p: Principal, perms: Iterable<string>) {
  const missing = [...perms].filter((k) => !p.global.has(k as Permission));
  if (missing.length) throw new AuthError(403, `You can't grant permissions you don't hold yourself: ${missing.join(", ")}`);
}

/** Temporary passwords are random and shown to the admin exactly once. */
const tempPassword = () => `${randomToken(9)}-${randomToken(6)}`;

async function roleWithPerms(id: string) {
  const role = await db.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  if (!role) throw new ServiceError("INVALID_ROLE", "Role not found", 404);
  return { role, perms: role.permissions.map((rp) => rp.permission.key) };
}

/** Super Admins = users with an org-wide binding to a role holding every permission. */
async function countFullAdmins(excludeUserId?: string, client: Prisma.TransactionClient = db) {
  const total = await client.permission.count();
  const roles = await client.role.findMany({ include: { _count: { select: { permissions: true } } } });
  const fullRoleIds = roles.filter((r) => r._count.permissions === total).map((r) => r.id);
  return client.userRole.count({
    where: { roleId: { in: fullRoleIds }, projectId: null, user: { status: "ACTIVE", deletedAt: null, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) } },
  });
}

/**
 * You may only administer users who are not more privileged than you:
 * resetting a Super Admin's password would otherwise be an account takeover.
 */
async function assertCanManageUser(p: Principal, targetId: string) {
  const current = await db.userRole.findMany({ where: { userId: targetId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  const perms = current.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key));
  const missing = [...new Set(perms)].filter((k) => !p.global.has(k as Permission));
  if (missing.length) throw new AuthError(403, "This user has permissions you don't hold, so you can't manage their account");
}

export interface Binding {
  roleId: string;
  projectId: string | null;
}

async function validateBindings(ctx: Ctx, bindings: Binding[]) {
  if (!bindings.length) throw new ServiceError("NO_ROLE", "Assign at least one role");
  for (const b of bindings) {
    const { perms } = await roleWithPerms(b.roleId);
    assertCanGrant(ctx.principal, perms);
    if (b.projectId && !(await db.project.findFirst({ where: { id: b.projectId, deletedAt: null } }))) {
      throw new ServiceError("INVALID_PROJECT", "Project not found");
    }
  }
}

// ───────────── Users ─────────────

export async function inviteUser(ctx: Ctx, input: { name: string; email: string; bindings: Binding[] }) {
  assertPermission(ctx.principal, "user.manage");
  await validateBindings(ctx, input.bindings);
  if (await db.user.findUnique({ where: { email: input.email } })) throw new ServiceError("EMAIL_TAKEN", "A user with this email already exists", 409);

  const password = tempPassword();
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      mustChangePassword: true,
      createdBy: ctx.principal.userId,
      userRoles: { create: input.bindings.map((b) => ({ roleId: b.roleId, projectId: b.projectId, createdBy: ctx.principal.userId })) },
    },
  });
  await audit({ userId: ctx.principal.userId, action: "Invited user", resourceType: "user", resourceId: user.id, resourceName: user.email, ip: ctx.ip, result: "success" });
  return { id: user.id, email: user.email, temporaryPassword: password };
}

export async function updateUser(ctx: Ctx, id: string, input: { name?: string; status?: "ACTIVE" | "DISABLED"; bindings?: Binding[] }) {
  assertPermission(ctx.principal, "user.manage");
  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new ServiceError("NOT_FOUND", "User not found", 404);
  const self = id === ctx.principal.userId;
  if (!self) await assertCanManageUser(ctx.principal, id);

  if (input.status === "DISABLED") {
    if (self) throw new ServiceError("SELF_LOCKOUT", "You can't disable your own account", 409);
    if ((await countFullAdmins(id)) === 0) throw new ServiceError("LAST_ADMIN", "This is the last Super Admin — promote someone else first", 409);
  }
  if (input.bindings) {
    await validateBindings(ctx, input.bindings);
    if (self) throw new ServiceError("SELF_ROLE", "You can't change your own roles — ask another admin", 409);
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { name: input.name, status: input.status } });
    if (input.bindings) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: input.bindings.map((b) => ({ userId: id, roleId: b.roleId, projectId: b.projectId, createdBy: ctx.principal.userId })) });
    }
    // Any status or role change invalidates existing sessions so it takes effect immediately.
    if (input.status || input.bindings) await tx.session.deleteMany({ where: { userId: id } });
    // Checked inside the transaction so a failing check rolls the change back.
    if (input.bindings && (await countFullAdmins(undefined, tx)) === 0) {
      throw new ServiceError("LAST_ADMIN", "At least one Super Admin must remain", 409);
    }
  });

  const what = input.status ? (input.status === "DISABLED" ? "Disabled user" : "Enabled user") : input.bindings ? "Changed user roles" : "Updated user";
  await audit({ userId: ctx.principal.userId, action: what, resourceType: "user", resourceId: id, resourceName: user.email, ip: ctx.ip, result: "success" });
  return { ok: true };
}

export async function resetPassword(ctx: Ctx, id: string) {
  assertPermission(ctx.principal, "user.manage");
  if (id === ctx.principal.userId) throw new ServiceError("SELF_RESET", "Use Account → Change password for your own account", 409);
  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new ServiceError("NOT_FOUND", "User not found", 404);
  await assertCanManageUser(ctx.principal, id);
  const password = tempPassword();
  await db.$transaction([
    db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);
  await audit({ userId: ctx.principal.userId, action: "Reset password", resourceType: "user", resourceId: id, resourceName: user.email, ip: ctx.ip, result: "success" });
  return { temporaryPassword: password };
}

// ───────────── Roles ─────────────

export async function listRoles() {
  const roles = await db.role.findMany({
    orderBy: [{ builtIn: "desc" }, { name: "asc" }],
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    builtIn: r.builtIn,
    permissions: r.permissions.map((rp) => rp.permission.key as Permission),
    assignments: r._count.userRoles,
  }));
}

async function permissionIds(keys: string[]) {
  const rows = await db.permission.findMany({ where: { key: { in: keys } } });
  if (rows.length !== new Set(keys).size) throw new ServiceError("INVALID_PERMISSION", "Unknown permission in list");
  return rows.map((r) => r.id);
}

export async function createRole(ctx: Ctx, input: { name: string; description?: string; permissions: string[] }) {
  assertPermission(ctx.principal, "user.manage");
  assertCanGrant(ctx.principal, input.permissions);
  if (await db.role.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } })) throw new ServiceError("NAME_TAKEN", `Role "${input.name}" already exists`, 409);
  const org = await db.organization.findFirstOrThrow({ where: { slug: "default" } });
  const ids = await permissionIds(input.permissions);
  const role = await db.role.create({
    data: {
      name: input.name,
      description: input.description || null,
      organizationId: org.id,
      builtIn: false,
      createdBy: ctx.principal.userId,
      permissions: { create: ids.map((permissionId) => ({ permissionId })) },
    },
  });
  await audit({ userId: ctx.principal.userId, action: "Created role", resourceType: "role", resourceId: role.id, resourceName: role.name, ip: ctx.ip, result: "success" });
  return { id: role.id };
}

export async function updateRole(ctx: Ctx, id: string, input: { name?: string; description?: string; permissions?: string[] }) {
  assertPermission(ctx.principal, "user.manage");
  const { role, perms } = await roleWithPerms(id);
  if (role.builtIn) throw new ServiceError("BUILT_IN", "Built-in roles can't be edited — create a custom role instead", 409);
  assertCanGrant(ctx.principal, [...perms, ...(input.permissions ?? [])]);
  const ids = input.permissions ? await permissionIds(input.permissions) : null;
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { name: input.name, description: input.description } });
    if (ids) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: id, permissionId })) });
    }
    // Holders of this role get new permissions on their next request; force re-login for safety.
    if (ids) await tx.session.deleteMany({ where: { user: { userRoles: { some: { roleId: id } } } } });
  });
  await audit({ userId: ctx.principal.userId, action: "Updated role", resourceType: "role", resourceId: id, resourceName: input.name ?? role.name, ip: ctx.ip, result: "success" });
  return { ok: true };
}

export async function deleteRole(ctx: Ctx, id: string) {
  assertPermission(ctx.principal, "user.manage");
  const { role, perms } = await roleWithPerms(id);
  if (role.builtIn) throw new ServiceError("BUILT_IN", "Built-in roles can't be deleted", 409);
  assertCanGrant(ctx.principal, perms);
  const inUse = await db.userRole.count({ where: { roleId: id } });
  if (inUse) throw new ServiceError("IN_USE", `Role is assigned to ${inUse} user(s) — reassign them first`, 409);
  await db.role.delete({ where: { id } });
  await audit({ userId: ctx.principal.userId, action: "Deleted role", resourceType: "role", resourceId: id, resourceName: role.name, ip: ctx.ip, result: "success" });
  return { ok: true };
}

// ───────────── Quotas ─────────────

export interface QuotaInput {
  scope: "PROJECT" | "USER" | "TEAM";
  scopeId: string;
  maxInstances: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
}

export async function listQuotas() {
  const [quotas, projects, users, teams] = await Promise.all([
    db.resourceQuota.findMany(),
    db.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true, email: true } }),
    db.team.findMany({ select: { id: true, name: true } }),
  ]);
  const label = (scope: string, id: string) =>
    scope === "PROJECT" ? projects.find((p) => p.id === id)?.name : scope === "USER" ? users.find((u) => u.id === id)?.email : teams.find((t) => t.id === id)?.name;
  return {
    quotas: quotas.map((q) => ({
      id: q.id, scope: q.scope, scopeId: q.scopeId, label: label(q.scope, q.scopeId) ?? "(deleted)",
      maxInstances: q.maxInstances, maxCpuCores: q.maxCpuCores, maxMemoryGb: Math.round(q.maxMemoryMb / 1024), maxStorageGb: q.maxStorageGb,
    })),
    targets: { projects, users: users.map((u) => ({ id: u.id, name: u.email })), teams },
  };
}

export async function upsertQuota(ctx: Ctx, q: QuotaInput) {
  assertPermission(ctx.principal, "user.manage");
  const exists =
    q.scope === "PROJECT" ? await db.project.findFirst({ where: { id: q.scopeId, deletedAt: null } })
    : q.scope === "USER" ? await db.user.findFirst({ where: { id: q.scopeId, deletedAt: null } })
    : await db.team.findUnique({ where: { id: q.scopeId } });
  if (!exists) throw new ServiceError("INVALID_TARGET", "Quota target not found", 404);
  const data = { maxInstances: q.maxInstances, maxCpuCores: q.maxCpuCores, maxMemoryMb: q.maxMemoryGb * 1024, maxStorageGb: q.maxStorageGb };
  const row = await db.resourceQuota.upsert({
    where: { scope_scopeId: { scope: q.scope, scopeId: q.scopeId } },
    create: { scope: q.scope, scopeId: q.scopeId, ...data, createdBy: ctx.principal.userId },
    update: data,
  });
  await audit({ userId: ctx.principal.userId, action: "Set quota", resourceType: "quota", resourceId: row.id, resourceName: `${q.scope.toLowerCase()}:${q.scopeId}`, ip: ctx.ip, result: "success", metadata: data });
  return { id: row.id };
}

export async function deleteQuota(ctx: Ctx, id: string) {
  assertPermission(ctx.principal, "user.manage");
  const row = await db.resourceQuota.findUnique({ where: { id } });
  if (!row) throw new ServiceError("NOT_FOUND", "Quota not found", 404);
  await db.resourceQuota.delete({ where: { id } });
  await audit({ userId: ctx.principal.userId, action: "Removed quota", resourceType: "quota", resourceId: id, resourceName: `${row.scope.toLowerCase()}:${row.scopeId}`, ip: ctx.ip, result: "success" });
  return { ok: true };
}

// ───────────── Own account ─────────────

export async function changeOwnPassword(ctx: Ctx, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.principal.userId } });
  if (!(await verifyPassword(user.passwordHash, current))) throw new ServiceError("WRONG_PASSWORD", "Current password is incorrect", 400);
  if (current === next) throw new ServiceError("SAME_PASSWORD", "Choose a password you haven't just used", 400);
  const keep = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } }),
    // Sign out every other session; keep the one making this request.
    db.session.deleteMany({ where: { userId: user.id, ...(keep ? { sessionToken: { not: sha256(keep) } } : {}) } }),
  ]);
  await audit({ userId: user.id, action: "Changed own password", resourceType: "user", resourceId: user.id, resourceName: user.email, ip: ctx.ip, result: "success" });
  return { ok: true };
}
