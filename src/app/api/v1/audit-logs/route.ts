import { assertPermission } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { queries } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export const GET = route(async (ctx) => {
  assertPermission(ctx.principal, "audit.read");
  return queries.auditLogs(200);
});
