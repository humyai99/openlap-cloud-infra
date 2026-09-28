import { inviteUser } from "@/lib/server/admin";
import { assertPermission } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { queries } from "@/lib/server/queries";
import { inviteUserSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async (ctx) => {
  assertPermission(ctx.principal, "user.manage");
  return queries.users();
});

/** Creates the account with a one-time temporary password (returned once). */
export const POST = route(async (ctx, req) => inviteUser(ctx, inviteUserSchema.parse(await req.json())), { status: 201 });
