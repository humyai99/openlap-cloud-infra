import { changeOwnPassword } from "@/lib/server/admin";
import { route } from "@/lib/server/http";
import { passwordSchema } from "@/lib/validation/instance";

/** Allowed while a temporary password is pending — it's how the user clears it. */
export const POST = route(async (ctx, req) => {
  const { current, next } = passwordSchema.parse(await req.json());
  return changeOwnPassword(ctx, current, next);
}, { allowPendingPassword: true });
