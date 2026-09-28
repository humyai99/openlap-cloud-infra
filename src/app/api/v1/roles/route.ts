import { createRole, listRoles } from "@/lib/server/admin";
import { assertPermission } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { roleSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async (ctx) => {
  assertPermission(ctx.principal, "user.manage");
  return listRoles();
});
export const POST = route(async (ctx, req) => createRole(ctx, roleSchema.parse(await req.json())), { status: 201 });
