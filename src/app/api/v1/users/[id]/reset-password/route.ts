import { resetPassword } from "@/lib/server/admin";
import { route } from "@/lib/server/http";

export const POST = route<{ id: string }>((ctx, _req, { id }) => resetPassword(ctx, id));
