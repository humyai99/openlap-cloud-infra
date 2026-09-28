import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { ServiceError } from "@/lib/server/instances";

export const DELETE = route<{ id: string }>(async ({ principal, ip }, _req, { id }) => {
  const key = await db.apiKey.findFirst({ where: { id, userId: principal.userId, revokedAt: null } });
  if (!key) throw new ServiceError("NOT_FOUND", "API key not found", 404);
  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit({ userId: principal.userId, action: "Revoked API key", resourceType: "api_key", resourceId: id, resourceName: `${key.name} (${key.prefix})`, ip, result: "success" });
  return { ok: true };
});
