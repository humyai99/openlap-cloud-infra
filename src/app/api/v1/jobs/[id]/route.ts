import { getJobFor } from "@/lib/server/instances";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>((ctx, _req, { id }) => getJobFor(ctx, id));
