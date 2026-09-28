import { deleteRole, updateRole } from "@/lib/server/admin";
import { route } from "@/lib/server/http";
import { roleSchema } from "@/lib/validation/instance";

type P = { id: string };

export const PATCH = route<P>(async (ctx, req, { id }) => updateRole(ctx, id, roleSchema.partial().parse(await req.json())));
export const DELETE = route<P>((ctx, _req, { id }) => deleteRole(ctx, id));
