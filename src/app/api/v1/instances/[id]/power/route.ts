import { powerAction } from "@/lib/server/instances";
import { route } from "@/lib/server/http";
import { powerActionSchema } from "@/lib/validation/instance";

export const POST = route<{ id: string }>(async (ctx, req, { id }) => powerAction(ctx, id, powerActionSchema.parse(await req.json()).action), { status: 202 });
