import { cloneInstance } from "@/lib/server/instances";
import { route } from "@/lib/server/http";
import { cloneSchema } from "@/lib/validation/instance";

export const POST = route<{ id: string }>(async (ctx, req, { id }) => cloneInstance(ctx, id, cloneSchema.parse(await req.json()).name), { status: 202 });
