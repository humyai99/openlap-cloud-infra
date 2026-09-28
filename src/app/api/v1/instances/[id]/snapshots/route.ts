import { listSnapshots, snapshotInstance } from "@/lib/server/instances";
import { route } from "@/lib/server/http";
import { toSnapshot } from "@/lib/server/mappers";
import { snapshotSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = route<P>(async (ctx, _req, { id }) => (await listSnapshots(ctx, id)).map(toSnapshot));
export const POST = route<P>(async (ctx, req, { id }) => {
  const { name, includeMemory } = snapshotSchema.parse(await req.json());
  return snapshotInstance(ctx, id, name, includeMemory);
}, { status: 202 });
