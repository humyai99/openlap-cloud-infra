import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, visibleProjectIds } from "@/lib/server/auth";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { fakePrincipal } from "../helpers";

describe("built-in roles", () => {
  it("Super Admin holds every permission, Viewer none", () => {
    expect(ROLE_PERMISSIONS["Super Admin"].sort()).toEqual(PERMISSIONS.map((p) => p.key).sort());
    expect(ROLE_PERMISSIONS.Viewer).toEqual([]);
  });

  it("only Super Admin can manage users", () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(perms.includes("user.manage"), role).toBe(role === "Super Admin");
    }
  });

  it("Developer can create but not delete VMs", () => {
    expect(can("Developer", "vm.create")).toBe(true);
    expect(can("Developer", "vm.delete")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("org-wide grants apply to every project", () => {
    const p = fakePrincipal({ global: ["vm.start"] });
    expect(hasPermission(p, "vm.start")).toBe(true);
    expect(hasPermission(p, "vm.start", "any-project")).toBe(true);
    expect(hasPermission(p, "vm.delete", "any-project")).toBe(false);
  });

  it("project grants apply only to that project", () => {
    const p = fakePrincipal({ projects: { web: ["vm.create"] } });
    expect(hasPermission(p, "vm.create", "web")).toBe(true);
    expect(hasPermission(p, "vm.create", "lab")).toBe(false);
    expect(hasPermission(p, "vm.create")).toBe(false); // no project given → org-wide check only
  });

  it("API key scopes narrow the owner's permissions", () => {
    const p = fakePrincipal({ global: ["vm.start", "vm.delete"], scopes: ["vm.start"] });
    expect(hasPermission(p, "vm.start")).toBe(true);
    expect(hasPermission(p, "vm.delete")).toBe(false);
  });

  it("assertPermission throws 403", () => {
    const p = fakePrincipal({});
    expect(() => assertPermission(p, "audit.read")).toThrowError(expect.objectContaining({ status: 403 }));
  });
});

describe("visibleProjectIds", () => {
  it("org-wide role sees everything (null)", () => {
    expect(visibleProjectIds(fakePrincipal({ global: ["vm.console"] }))).toBeNull();
  });

  it("project-only user sees just their projects", () => {
    expect(visibleProjectIds(fakePrincipal({ projects: { web: ["vm.start"], lab: [] } }))?.sort()).toEqual(["lab", "web"]);
  });

  it("user with no bindings sees nothing", () => {
    expect(visibleProjectIds(fakePrincipal({}))).toEqual([]);
  });
});
