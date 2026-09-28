/**
 * Typed browser client for the OpenLab REST API (/api/v1).
 * UI components must go through this client — never call providers directly.
 */
import type { ApiError, AuditLog, Instance, InstanceType, Job, PowerAction, Snapshot } from "@/lib/types";
import type { CreateInstanceInput, networkSchema } from "@/lib/validation/instance";
import type { z } from "zod";

export type NetworkInput = z.input<typeof networkSchema>;
export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as ({ data: T } & Partial<ApiError>) | null;
  if (!res.ok || !body) {
    throw new ApiClientError(body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

const post = <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

export const api = {
  system: () => request<{ provider: string; isReal: boolean; version: string }>("/system"),
  listInstances: (type?: InstanceType) => request<Instance[]>(`/instances${type ? `?type=${type}` : ""}`),
  getInstance: (id: string) => request<Instance>(`/instances/${encodeURIComponent(id)}`),
  createInstance: (input: CreateInstanceInput) => post<Job>("/instances", input),
  deleteInstance: (id: string) => request<Job>(`/instances/${encodeURIComponent(id)}`, { method: "DELETE" }),
  power: (id: string, action: PowerAction) => post<Job>(`/instances/${encodeURIComponent(id)}/power`, { action }),
  clone: (id: string, name: string) => post<Job>(`/instances/${encodeURIComponent(id)}/clone`, { name }),
  listSnapshots: (id: string) => request<Snapshot[]>(`/instances/${encodeURIComponent(id)}/snapshots`),
  createSnapshot: (id: string, name: string, includeMemory = false) =>
    post<Job>(`/instances/${encodeURIComponent(id)}/snapshots`, { name, includeMemory }),
  resize: (id: string, cpuCores: number, memoryMb: number) =>
    request<Job>(`/instances/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ cpuCores, memoryMb }) }),
  restoreSnapshot: (id: string, snapshotId: string) => post<Job>(`/instances/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}`),
  deleteSnapshot: (id: string, snapshotId: string) =>
    request<Job>(`/instances/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}`, { method: "DELETE" }),
  createNetwork: (input: NetworkInput) => post<{ id: string }>("/networks", input),
  listApiKeys: () => request<ApiKeyInfo[]>("/api-keys"),
  createApiKey: (name: string, expiresInDays: number | null) => post<{ id: string; prefix: string; secret: string }>("/api-keys", { name, expiresInDays, scopes: [] }),
  revokeApiKey: (id: string) => request<{ ok: true }>(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getJob: (id: string) => request<Job>(`/jobs/${encodeURIComponent(id)}`),
  auditLogs: () => request<AuditLog[]>("/audit-logs"),
};

/** Polls a job until it finishes. Phase 2: replace with SSE/WebSocket push. */
export async function waitForJob(id: string, onUpdate?: (job: Job) => void, intervalMs = 600): Promise<Job> {
  for (;;) {
    const job = await api.getJob(id);
    onUpdate?.(job);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
