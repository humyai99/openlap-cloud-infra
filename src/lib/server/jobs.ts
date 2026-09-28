// Shared by API routes and the standalone worker (no "server-only").
import type { Prisma, PrismaClient } from "@prisma/client";
import type { JobStep, PowerAction } from "@/lib/types";
import { db } from "./db";

/**
 * Durable job queue on PostgreSQL. API routes insert a QUEUED row and return 202;
 * workers claim rows with `FOR UPDATE SKIP LOCKED`, so any number of worker
 * processes can run safely without Redis.
 */
export type JobPayload =
  | { kind: "vm.create"; instanceId: string; spec: Prisma.JsonObject }
  | { kind: "vm.clone"; sourceId: string; instanceId: string }
  | { kind: "vm.delete"; instanceId: string }
  | { kind: "vm.power"; instanceId: string; action: PowerAction }
  | { kind: "vm.resize"; instanceId: string; cpuCores: number; memoryMb: number }
  | { kind: "snapshot.create"; instanceId: string; name: string; includeMemory: boolean }
  | { kind: "snapshot.restore"; snapshotId: string }
  | { kind: "snapshot.delete"; snapshotId: string };

export interface JobMeta {
  actorId: string;
  ip: string;
  resourceName: string;
  resourceId: string | null;
  projectId: string | null;
  steps: string[];
}

/** Pass `client` (a transaction) to enqueue atomically with the state change that needs it. */
export async function enqueueJob(payload: JobPayload, meta: JobMeta, client: Prisma.TransactionClient | PrismaClient = db) {
  const steps: JobStep[] = meta.steps.map((label) => ({ label, status: "queued" }));
  return client.job.create({
    data: {
      kind: payload.kind,
      status: "QUEUED",
      steps: steps as unknown as Prisma.JsonArray,
      resourceType: "instance",
      resourceId: meta.resourceId,
      resourceName: meta.resourceName,
      projectId: meta.projectId,
      payload: { ...payload, ip: meta.ip } as unknown as Prisma.JsonObject,
      createdBy: meta.actorId,
    },
  });
}

/** Atomically claim the oldest queued job. Returns null when the queue is empty. */
export async function claimNextJob() {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE jobs SET status = 'RUNNING'::"JobStatus", started_at = now(), updated_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs WHERE status = 'QUEUED'::"JobStatus"
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id`;
  return rows[0] ? db.job.findUnique({ where: { id: rows[0].id } }) : null;
}
