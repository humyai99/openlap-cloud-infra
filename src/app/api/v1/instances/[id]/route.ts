import { deleteInstance, getInstance, resizeInstance } from "@/lib/server/instances";
import { route } from "@/lib/server/http";
import { resizeSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = route<P>((ctx, _req, { id }) => getInstance(ctx, id));
export const PATCH = route<P>(async (ctx, req, { id }) => resizeInstance(ctx, id, resizeSchema.parse(await req.json())), { status: 202 });
export const DELETE = route<P>((ctx, _req, { id }) => deleteInstance(ctx, id), { status: 202 });
