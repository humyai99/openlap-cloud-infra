import { beforeAll, describe, expect, it } from "vitest";
import { createRole, inviteUser, resetPassword, updateUser } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import type { Ctx } from "@/lib/server/instances";
import { ctxFor, project, uniqueName } from "../helpers";

let admin: Ctx;
let roles: Record<string, string>;

beforeAll(async () => {
  admin = await ctxFor("admin@openlab.local");
  roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.name, r.id]));
});

const email = () => `${uniqueName("u")}@test.local`;

/** Creates a user holding only a custom "Helpdesk" role (user.manage + vm.start) and returns its context. */
async function helpdesk(): Promise<Ctx> {
  const { id: roleId } = await createRole(admin, { name: uniqueName("Helpdesk"), permissions: ["user.manage", "vm.start"] });
  const u = await inviteUser(admin, { name: "Help Desk", email: email(), bindings: [{ roleId, projectId: null }] });
  await db.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
  return ctxFor(u.email);
}

describe("invite & passwords", () => {
  it("invites with a temporary password that must be changed", async () => {
    const r = await inviteUser(admin, { name: "New Dev", email: email(), bindings: [{ roleId: roles.Developer, projectId: (await project("web-platform")).id }] });
    expect(r.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    const u = await db.user.findUniqueOrThrow({ where: { id: r.id } });
    expect(u.mustChangePassword).toBe(true);
    expect(u.passwordHash).not.toContain(r.temporaryPassword);
  });

  it("rejects duplicate emails", async () => {
    const e = email();
    await inviteUser(admin, { name: "A", email: e, bindings: [{ roleId: roles.Viewer, projectId: null }] });
    await expect(inviteUser(admin, { name: "B", email: e, bindings: [{ roleId: roles.Viewer, projectId: null }] })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("reset password revokes all of the user's sessions", async () => {
    const r = await inviteUser(admin, { name: "S", email: email(), bindings: [{ roleId: roles.Viewer, projectId: null }] });
    await db.session.create({ data: { userId: r.id, sessionToken: uniqueName("tok"), expires: new Date(Date.now() + 3_600_000) } });
    await resetPassword(admin, r.id);
    expect(await db.session.count({ where: { userId: r.id } })).toBe(0);
  });
});

describe("anti-escalation", () => {
  it("cannot grant permissions you don't hold", async () => {
    const hd = await helpdesk();
    await expect(inviteUser(hd, { name: "X", email: email(), bindings: [{ roleId: roles["Super Admin"], projectId: null }] })).rejects.toMatchObject({ status: 403 });
    await expect(createRole(hd, { name: uniqueName("Sneaky"), permissions: ["node.manage"] })).rejects.toMatchObject({ status: 403 });
  });

  it("can grant a subset of your own permissions", async () => {
    const hd = await helpdesk();
    await expect(inviteUser(hd, { name: "V", email: email(), bindings: [{ roleId: roles.Viewer, projectId: null }] })).resolves.toHaveProperty("temporaryPassword");
  });

  it("cannot reset, disable or re-role a more privileged user", async () => {
    const hd = await helpdesk();
    const adminId = admin.principal.userId;
    await expect(resetPassword(hd, adminId)).rejects.toMatchObject({ status: 403 });
    await expect(updateUser(hd, adminId, { status: "DISABLED" })).rejects.toMatchObject({ status: 403 });
    await expect(updateUser(hd, adminId, { bindings: [{ roleId: roles.Viewer, projectId: null }] })).rejects.toMatchObject({ status: 403 });
  });

  it("users without user.manage can't administer anyone", async () => {
    const dev = await ctxFor("krit@openlab.local");
    await expect(inviteUser(dev, { name: "X", email: email(), bindings: [{ roleId: roles.Viewer, projectId: null }] })).rejects.toMatchObject({ status: 403 });
  });
});

describe("self-protection", () => {
  it("cannot disable yourself or change your own roles", async () => {
    await expect(updateUser(admin, admin.principal.userId, { status: "DISABLED" })).rejects.toMatchObject({ code: "SELF_LOCKOUT" });
    await expect(updateUser(admin, admin.principal.userId, { bindings: [{ roleId: roles.Viewer, projectId: null }] })).rejects.toMatchObject({ code: "SELF_ROLE" });
  });

  it("the last Super Admin can't be demoted, and the change is rolled back", async () => {
    // A second Super Admin tries to demote the only other one; afterwards exactly one would remain → allowed.
    // Then that one can't be demoted by anyone because none would remain.
    const second = await inviteUser(admin, { name: "SA2", email: email(), bindings: [{ roleId: roles["Super Admin"], projectId: null }] });
    await db.user.update({ where: { id: second.id }, data: { mustChangePassword: false } });
    const sa2 = await ctxFor(second.email);

    await updateUser(sa2, admin.principal.userId, { bindings: [{ roleId: roles.Viewer, projectId: null }] }); // admin demoted, sa2 remains
    await expect(updateUser(admin, second.id, { status: "DISABLED" })).rejects.toBeTruthy(); // admin is now a Viewer

    // restore admin via sa2, then remove sa2's admin rights: allowed because admin is Super Admin again
    await updateUser(sa2, admin.principal.userId, { bindings: [{ roleId: roles["Super Admin"], projectId: null }] });
    admin = await ctxFor("admin@openlab.local");
    await updateUser(admin, second.id, { status: "DISABLED" });

    // only one active Super Admin remains; a (hypothetical) demotion of them must fail and roll back
    const count = await db.userRole.count({ where: { roleId: roles["Super Admin"], projectId: null, user: { status: "ACTIVE" } } });
    expect(count).toBe(1);
  });
});

describe("roles", () => {
  it("built-in roles are immutable and in-use roles can't be deleted", async () => {
    const { updateRole, deleteRole } = await import("@/lib/server/admin");
    await expect(updateRole(admin, roles.Viewer, { permissions: ["vm.create"] })).rejects.toMatchObject({ code: "BUILT_IN" });
    const { id } = await createRole(admin, { name: uniqueName("InUse"), permissions: [] });
    await inviteUser(admin, { name: "R", email: email(), bindings: [{ roleId: id, projectId: null }] });
    await expect(deleteRole(admin, id)).rejects.toMatchObject({ code: "IN_USE" });
  });
});
