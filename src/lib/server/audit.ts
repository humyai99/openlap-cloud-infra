// Shared by API routes and the standalone worker (no "server-only").
import { db } from "./db";

export interface AuditEntry {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  ip: string;
  userAgent?: string | null;
  result: "success" | "failure";
  metadata?: Record<string, unknown>;
}

/** Append-only audit trail. Never throws — auditing must not break the operation. */
export async function audit(e: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        userId: e.userId,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        resourceName: e.resourceName,
        ipAddress: e.ip,
        userAgent: e.userAgent ?? null,
        result: e.result,
        metadata: e.metadata as object | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write entry", err);
  }
}
