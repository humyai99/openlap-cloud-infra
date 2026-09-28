import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Permission } from "@/lib/types";
import { randomToken, sha256 } from "./crypto";
import { db } from "./db";

/**
 * Server-side session authentication.
 * The cookie holds a random token; the DB stores only SHA-256(token), so a DB leak
 * cannot be replayed and sessions can be revoked instantly.
 */
/**
 * Secure cookies are on in production. They require HTTPS — the bundled Nginx terminates TLS.
 * OPENLAB_SECURE_COOKIES=false exists only for trusted lab networks without TLS.
 */
const SECURE_COOKIES = process.env.OPENLAB_SECURE_COOKIES ? process.env.OPENLAB_SECURE_COOKIES !== "false" : process.env.NODE_ENV === "production";
// The __Host- prefix makes browsers enforce Secure + Path=/ + no Domain, but only works with Secure.
export const SESSION_COOKIE = SECURE_COOKIES ? "__Host-openlab_session" : "openlab_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface Principal {
  userId: string;
  email: string;
  name: string;
  via: "session" | "api_key";
  /** Temporary password issued by an admin; everything except changing it is blocked. */
  mustChangePassword: boolean;
  /** Permissions granted organization-wide. */
  global: Set<Permission>;
  /** Permissions granted per project id. */
  byProject: Map<string, Set<Permission>>;
  /** API key scopes (intersected with role permissions). null = no restriction. */
  scopes: Set<string> | null;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function createSession(userId: string, ip: string, userAgent: string | null) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, sessionToken: sha256(token), expires, ipAddress: ip, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { sessionToken: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function loadPrincipal(userId: string, via: Principal["via"], scopes: string[] | null): Promise<Principal | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null, status: "ACTIVE" },
    include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user) return null;
  const global = new Set<Permission>();
  const byProject = new Map<string, Set<Permission>>();
  for (const ur of user.userRoles) {
    const perms = ur.role.permissions.map((rp) => rp.permission.key as Permission);
    const target = ur.projectId ? (byProject.get(ur.projectId) ?? byProject.set(ur.projectId, new Set()).get(ur.projectId)!) : global;
    perms.forEach((p) => target.add(p));
  }
  return { userId: user.id, email: user.email, name: user.name, via, mustChangePassword: user.mustChangePassword, global, byProject, scopes: scopes ? new Set(scopes) : null };
}

/** Resolves the caller from the session cookie or an `Authorization: Bearer olk_…` API key. */
export async function getPrincipal(): Promise<Principal | null> {
  const h = await headers();
  const authz = h.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const raw = authz.slice(7).trim();
    const [prefix] = raw.split(".");
    const key = await db.apiKey.findUnique({ where: { prefix } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date()) || key.secretHash !== sha256(raw)) return null;
    void db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    return loadPrincipal(key.userId, "api_key", key.scopes.length ? key.scopes : null);
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { sessionToken: sha256(token) } });
  if (!session || session.expires < new Date()) return null;
  return loadPrincipal(session.userId, "session", null);
}

/** For Server Components / pages: redirect to login when not signed in. */
export async function requireUser(): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  return p;
}

/** For API routes. `allowPendingPassword` lets the change-password endpoint through. */
export async function requireApiUser(opts: { allowPendingPassword?: boolean } = {}): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) throw new AuthError(401, "Sign in required");
  if (p.mustChangePassword && !opts.allowPendingPassword) throw new AuthError(403, "Change your temporary password first");
  return p;
}

export function hasPermission(p: Principal, perm: Permission, projectId?: string | null): boolean {
  if (p.scopes && !p.scopes.has(perm)) return false;
  if (p.global.has(perm)) return true;
  return !!projectId && !!p.byProject.get(projectId)?.has(perm);
}

export function assertPermission(p: Principal, perm: Permission, projectId?: string | null) {
  if (!hasPermission(p, perm, projectId)) throw new AuthError(403, `You don't have permission to do this (${perm})`);
}

/**
 * Project ids the caller may see. `null` means all (org-wide role).
 * Any org-wide role grants visibility; otherwise only projects with a binding.
 */
export function visibleProjectIds(p: Principal): string[] | null {
  if (p.global.size > 0 && !p.scopes) return null;
  if (p.global.size > 0 && p.scopes && [...p.global].some((x) => p.scopes!.has(x))) return null;
  return [...p.byProject.keys()];
}

export async function isMember(p: Principal, projectId: string) {
  const ids = visibleProjectIds(p);
  return ids === null || ids.includes(projectId);
}
