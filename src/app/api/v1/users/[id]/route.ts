import { updateUser } from "@/lib/server/admin";
import { route } from "@/lib/server/http";
import { updateUserSchema } from "@/lib/validation/instance";

export const PATCH = route<{ id: string }>(async (ctx, req, { id }) => updateUser(ctx, id, updateUserSchema.parse(await req.json())));
