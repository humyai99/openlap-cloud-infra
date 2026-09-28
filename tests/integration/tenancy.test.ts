import { describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { createInstance, deleteInstance, getInstance, listInstances, powerAction } from "@/lib/server/instances";
import { ctxFor, project, vmSpec } from "../helpers";

describe("multi-tenant isolation", () => {
  it("a project-scoped Developer only sees their project", async () => {
    const dev = await ctxFor("krit@openlab.local");
    const web = await project("web-platform");
    const list = await listInstances(dev);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.projectId === web.id)).toBe(true);
  });

  it("instances in other projects look like they don't exist (404, not 403)", async () => {
    const dev = await ctxFor("krit@openlab.local");
    const other = await db.instance.findFirstOrThrow({ where: { project: { name: "default" }, deletedAt: null } });
    await expect(getInstance(dev, other.id)).rejects.toMatchObject({ status: 404 });
    await expect(powerAction(dev, other.id, "stop")).rejects.toMatchObject({ status: 404 });
  });

  it("Developer can't create VMs outside their project", async () => {
    const dev = await ctxFor("krit@openlab.local");
    await expect(createInstance(dev, await vmSpec("default"))).rejects.toMatchObject({ status: 403 });
  });

  it("Developer can create in their project but not delete VMs", async () => {
    const dev = await ctxFor("krit@openlab.local");
    await expect(createInstance(dev, await vmSpec("web-platform"))).resolves.toHaveProperty("status", "queued");
    const vm = await db.instance.findFirstOrThrow({ where: { type: "VM", project: { name: "web-platform" }, deletedAt: null } });
    await expect(deleteInstance(dev, vm.id)).rejects.toMatchObject({ status: 403 });
  });

  it("an org-wide admin sees every project", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const projects = new Set((await listInstances(admin)).map((i) => i.projectId));
    expect(projects.size).toBe(3);
  });

  it("rejects duplicate names within a project", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const existing = await db.instance.findFirstOrThrow({ where: { project: { name: "default" }, deletedAt: null } });
    await expect(createInstance(admin, await vmSpec("default", { name: existing.name }))).rejects.toMatchObject({ code: "NAME_TAKEN" });
  });

  it("refuses to provision on an offline node", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const node = await db.node.findFirstOrThrow({ where: { status: "ONLINE" } });
    await db.node.update({ where: { id: node.id }, data: { status: "OFFLINE" } });
    try {
      await expect(createInstance(admin, await vmSpec("default", { nodeId: node.id }))).rejects.toMatchObject({ code: "NODE_OFFLINE" });
    } finally {
      await db.node.update({ where: { id: node.id }, data: { status: "ONLINE" } });
    }
  });
});
