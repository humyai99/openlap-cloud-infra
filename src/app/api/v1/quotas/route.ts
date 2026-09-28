import { listQuotas, upsertQuota } from "@/lib/server/admin";
import { assertPermission } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { quotaSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async (ctx) => {
  assertPermission(ctx.principal, "user.manage");
  return listQuotas();
});
/** Create or replace the quota for one scope (project / user / team). */
export const PUT = route(async (ctx, req) => upsertQuota(ctx, quotaSchema.parse(await req.json())));
