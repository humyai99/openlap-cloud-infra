import { describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { claimNextJob, enqueueJob } from "@/lib/server/jobs";

async function drain() {
  // Clear anything other tests queued so counts here are exact.
  await db.job.updateMany({ where: { status: "QUEUED" }, data: { status: "COMPLETED" } });
}

describe("job queue", () => {
  it("returns null when the queue is empty", async () => {
    await drain();
    expect(await claimNextJob()).toBeNull();
  });

  it("claims oldest first and marks the job RUNNING", async () => {
    await drain();
    const meta = { actorId: (await db.user.findFirstOrThrow()).id, ip: "127.0.0.1", resourceName: "x", resourceId: null, projectId: null, steps: ["one"] };
    const a = await enqueueJob({ kind: "vm.delete", instanceId: "00000000-0000-0000-0000-000000000001" }, meta);
    await enqueueJob({ kind: "vm.delete", instanceId: "00000000-0000-0000-0000-000000000002" }, meta);
    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(a.id);
    expect(claimed?.status).toBe("RUNNING");
    expect(claimed?.attempts).toBe(1);
    expect(claimed?.startedAt).toBeInstanceOf(Date);
  });

  it("never hands the same job to two workers (FOR UPDATE SKIP LOCKED)", async () => {
    await drain();
    const meta = { actorId: (await db.user.findFirstOrThrow()).id, ip: "127.0.0.1", resourceName: "x", resourceId: null, projectId: null, steps: ["one"] };
    const queued = await Promise.all(Array.from({ length: 20 }, (_, i) => enqueueJob({ kind: "vm.delete", instanceId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}` }, meta)));

    // 30 concurrent "workers" race for 20 jobs.
    const claims = await Promise.all(Array.from({ length: 30 }, () => claimNextJob()));
    const ids = claims.filter((c) => c !== null).map((c) => c!.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(new Set(ids)).toEqual(new Set(queued.map((q) => q.id)));
  });
});
