import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { createInstance } from "@/lib/server/instances";
import { ctxFor, project, projectCpu, vmSpec } from "../helpers";

const restore: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  while (restore.length) await restore.pop()!();
});

/** Sets a quota for the duration of one test, restoring the previous state afterwards. */
async function withQuota(scope: "PROJECT" | "USER" | "TEAM", scopeId: string, q: { maxInstances?: number; maxCpuCores?: number; maxMemoryMb?: number; maxStorageGb?: number }) {
  const prev = await db.resourceQuota.findUnique({ where: { scope_scopeId: { scope, scopeId } } });
  const data = { maxInstances: 10_000, maxCpuCores: 10_000, maxMemoryMb: 10_000_000, maxStorageGb: 10_000_000, ...q };
  await db.resourceQuota.upsert({ where: { scope_scopeId: { scope, scopeId } }, create: { scope, scopeId, ...data }, update: data });
  restore.push(() =>
    prev
      ? db.resourceQuota.update({ where: { id: prev.id }, data: { maxInstances: prev.maxInstances, maxCpuCores: prev.maxCpuCores, maxMemoryMb: prev.maxMemoryMb, maxStorageGb: prev.maxStorageGb } })
      : db.resourceQuota.delete({ where: { scope_scopeId: { scope, scopeId } } }),
  );
}

describe("quota enforcement", () => {
  it("rejects a VM that would exceed the project CPU quota", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const lab = await project("university-lab");
    await withQuota("PROJECT", lab.id, { maxCpuCores: await projectCpu(lab.id) });
    await expect(createInstance(admin, await vmSpec("university-lab", { cpuCores: 1 }))).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 409 });
  });

  it("allows a VM that fits exactly", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const lab = await project("university-lab");
    await withQuota("PROJECT", lab.id, { maxCpuCores: (await projectCpu(lab.id)) + 2 });
    const job = await createInstance(admin, await vmSpec("university-lab", { cpuCores: 2 }));
    expect(job.status).toBe("queued");
  });

  it("enforces user quotas across projects", async () => {
    const admin = await ctxFor("admin@openlab.local");
    await withQuota("USER", admin.principal.userId, { maxInstances: 0 });
    await expect(createInstance(admin, await vmSpec("default"))).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", message: expect.stringContaining("User quota") });
  });

  it("enforces team quotas on the combined usage of members", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const team = await db.team.findFirstOrThrow({ where: { name: "platform" } });
    await withQuota("TEAM", team.id, { maxInstances: 0 });
    await expect(createInstance(admin, await vmSpec("default"))).rejects.toMatchObject({ message: expect.stringContaining('Team "platform"') });
  });

  it("serialises concurrent requests so only one squeezes under the limit", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const lab = await project("university-lab");
    await withQuota("PROJECT", lab.id, { maxCpuCores: (await projectCpu(lab.id)) + 4 });
    const specs = await Promise.all(Array.from({ length: 5 }, () => vmSpec("university-lab", { cpuCores: 4 })));
    const results = await Promise.allSettled(specs.map((s) => createInstance(admin, s)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(4);
  });

  it("does not leave an instance row behind when the quota check fails", async () => {
    const admin = await ctxFor("admin@openlab.local");
    const lab = await project("university-lab");
    await withQuota("PROJECT", lab.id, { maxInstances: 0 });
    const spec = await vmSpec("university-lab");
    await expect(createInstance(admin, spec)).rejects.toBeTruthy();
    expect(await db.instance.count({ where: { name: spec.name } })).toBe(0);
  });
});
