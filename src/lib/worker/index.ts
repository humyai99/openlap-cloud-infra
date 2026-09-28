/**
 * Job worker: Job Queue → Worker → Virtualization Provider → Hypervisor.
 * Runs in-process in dev (instrumentation.ts) or standalone via `npm run worker`.
 */
import type { Job as JobRow, Node as NodeRow, Prisma } from "@prisma/client";
import { getProvider, type NodeTarget, type ProvisionSpec } from "@/lib/providers";
import type { JobStep } from "@/lib/types";
import { audit } from "@/lib/server/audit";
import { decryptSecret } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { claimNextJob, type JobPayload } from "@/lib/server/jobs";

const CONCURRENCY = Number(process.env.OPENLAB_WORKER_CONCURRENCY ?? 4);
const POLL_MS = 1000;
const STALE_MS = 30 * 60 * 1000;

function target(n: NodeRow): NodeTarget {
  return { name: n.name, address: n.address, credential: n.credentialEncrypted ? decryptSecret(n.credentialEncrypted) : null };
}

async function setStep(job: JobRow, index: number) {
  const steps = (job.steps as unknown as JobStep[]).map((s, i) => ({ ...s, status: i < index ? "completed" : i === index ? "running" : "queued" }));
  job.steps = steps as unknown as Prisma.JsonArray;
  await db.job.update({ where: { id: job.id }, data: { steps: job.steps, progress: Math.round((index / steps.length) * 100) } });
}

async function loadInstance(id: string) {
  const inst = await db.instance.findUniqueOrThrow({ where: { id }, include: { node: true } });
  return { inst, node: inst.node, provider: getProvider(inst.node.provider), t: target(inst.node) };
}

const KIND_LABEL = (type: "VM" | "CONTAINER") => (type === "VM" ? "VM" : "container");

async function handle(job: JobRow, p: JobPayload & { ip: string }) {
  const actor = job.createdBy;
  const log = (action: string, name: string, id?: string, result: "success" | "failure" = "success") =>
    audit({ userId: actor, action, resourceType: "instance", resourceId: id, resourceName: name, ip: p.ip, result });

  switch (p.kind) {
    case "vm.create": {
      const { inst, provider, t } = await loadInstance(p.instanceId);
      try {
        const res = await provider.createVM(t, p.spec as unknown as ProvisionSpec, (i) => setStep(job, i));
        await db.instance.update({
          where: { id: inst.id },
          data: { providerRef: res.ref, macAddress: res.macAddress, ipv4: res.ipv4, status: "RUNNING", startedAt: new Date() },
        });
        await log(`Created ${KIND_LABEL(inst.type)}`, inst.name, inst.id);
      } catch (e) {
        await db.instance.update({ where: { id: inst.id }, data: { status: "ERROR" } });
        await log(`Created ${KIND_LABEL(inst.type)}`, inst.name, inst.id, "failure");
        throw e;
      }
      return;
    }
    case "vm.power": {
      const { inst, provider, t } = await loadInstance(p.instanceId);
      const ref = inst.providerRef ?? inst.id;
      try {
        const s =
          p.action === "start" ? await provider.startVM(t, ref)
          : p.action === "restart" ? await provider.restartVM(t, ref)
          : await provider.stopVM(t, ref, { force: p.action === "stop" });
        const running = s.status === "running";
        await db.instance.update({
          where: { id: inst.id },
          data: {
            status: running ? "RUNNING" : "STOPPED",
            ipv4: running ? (inst.ipv4 ?? s.ipv4) : inst.ipv4,
            startedAt: running ? (p.action === "start" || p.action === "restart" ? new Date() : inst.startedAt) : null,
          },
        });
        const verb = { start: "Started", stop: "Stopped", restart: "Restarted", shutdown: "Shut down" }[p.action];
        await log(`${verb} ${KIND_LABEL(inst.type)}`, inst.name, inst.id);
      } catch (e) {
        await db.instance.update({ where: { id: inst.id }, data: { status: "ERROR" } });
        throw e;
      }
      return;
    }
    case "vm.delete": {
      const { inst, provider, t } = await loadInstance(p.instanceId);
      if (inst.providerRef) await provider.deleteVM(t, inst.providerRef);
      await db.$transaction([
        db.snapshot.updateMany({ where: { instanceId: inst.id, deletedAt: null }, data: { deletedAt: new Date() } }),
        db.instance.update({ where: { id: inst.id }, data: { deletedAt: new Date(), status: "STOPPED" } }),
      ]);
      await log(`Deleted ${KIND_LABEL(inst.type)}`, inst.name, inst.id);
      return;
    }
    case "vm.clone": {
      const src = await loadInstance(p.sourceId);
      const clone = await db.instance.findUniqueOrThrow({ where: { id: p.instanceId } });
      try {
        const res = await src.provider.cloneVM(src.t, src.inst.providerRef ?? src.inst.id, clone.name);
        await db.instance.update({ where: { id: clone.id }, data: { providerRef: res.ref, macAddress: res.macAddress, status: "STOPPED" } });
        await log("Cloned instance", `${src.inst.name} → ${clone.name}`, clone.id);
      } catch (e) {
        await db.instance.update({ where: { id: clone.id }, data: { status: "ERROR" } });
        throw e;
      }
      return;
    }
    case "vm.resize": {
      const { inst, provider, t } = await loadInstance(p.instanceId);
      await provider.resizeVM(t, inst.providerRef ?? inst.id, { cpuCores: p.cpuCores, memoryMb: p.memoryMb });
      await db.instance.update({ where: { id: inst.id }, data: { cpuCores: p.cpuCores, memoryMb: p.memoryMb } });
      await log("Resized instance", `${inst.name} (${p.cpuCores} vCPU / ${p.memoryMb} MB)`, inst.id);
      return;
    }
    case "snapshot.create": {
      const { inst, provider, t } = await loadInstance(p.instanceId);
      const { sizeGb } = await provider.createSnapshot(t, inst.providerRef ?? inst.id, p.name, { includeMemory: p.includeMemory });
      await db.snapshot.create({ data: { instanceId: inst.id, name: p.name, includesMemory: p.includeMemory, sizeGb, createdBy: actor } });
      await log("Created snapshot", `${inst.name}@${p.name}`, inst.id);
      return;
    }
    case "snapshot.restore": {
      const snap = await db.snapshot.findUniqueOrThrow({ where: { id: p.snapshotId } });
      const { inst, provider, t } = await loadInstance(snap.instanceId);
      await provider.restoreSnapshot(t, inst.providerRef ?? inst.id, snap.name);
      await db.instance.update({ where: { id: inst.id }, data: { startedAt: inst.status === "RUNNING" ? new Date() : null } });
      await log("Restored snapshot", `${inst.name}@${snap.name}`, inst.id);
      return;
    }
    case "snapshot.delete": {
      const snap = await db.snapshot.findUniqueOrThrow({ where: { id: p.snapshotId } });
      const { inst, provider, t } = await loadInstance(snap.instanceId);
      await provider.deleteSnapshot(t, inst.providerRef ?? inst.id, snap.name);
      await db.snapshot.update({ where: { id: snap.id }, data: { deletedAt: new Date() } });
      await log("Deleted snapshot", `${inst.name}@${snap.name}`, inst.id);
      return;
    }
  }
}

async function runJob(job: JobRow) {
  try {
    await handle(job, job.payload as unknown as JobPayload & { ip: string });
    const steps = (job.steps as unknown as JobStep[]).map((s) => ({ ...s, status: "completed" }));
    await db.job.update({ where: { id: job.id }, data: { status: "COMPLETED", progress: 100, steps, finishedAt: new Date() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`[worker] job ${job.id} (${job.kind}) failed:`, message);
    const steps = (job.steps as unknown as JobStep[]).map((s) => ({ ...s, status: s.status === "running" ? "failed" : s.status }));
    await db.job.update({ where: { id: job.id }, data: { status: "FAILED", error: message, steps, finishedAt: new Date() } }).catch(() => undefined);
  }
}

/** Jobs left RUNNING by a crashed worker are failed so they don't hang forever in the UI. */
async function reapStale() {
  await db.job.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "FAILED", error: "Worker stopped before the job finished", finishedAt: new Date() },
  });
}

export function startWorker() {
  const g = globalThis as unknown as { __openlabWorker?: boolean };
  if (g.__openlabWorker) return;
  g.__openlabWorker = true;
  let active = 0;
  console.log(`[worker] started (concurrency ${CONCURRENCY}, provider ${process.env.OPENLAB_PROVIDER ?? "mock"})`);
  void reapStale().catch(() => undefined);

  const tick = async () => {
    try {
      while (active < CONCURRENCY) {
        const job = await claimNextJob();
        if (!job) break;
        active++;
        void runJob(job).finally(() => active--);
      }
    } catch (e) {
      console.error("[worker] poll failed:", e instanceof Error ? e.message : e);
    } finally {
      setTimeout(tick, POLL_MS);
    }
  };
  void tick();
}
