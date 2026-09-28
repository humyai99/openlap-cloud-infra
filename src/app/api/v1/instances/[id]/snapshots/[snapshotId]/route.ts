import { snapshotAction } from "@/lib/server/instances";
import { route } from "@/lib/server/http";

type P = { id: string; snapshotId: string };

/** POST = restore, DELETE = delete. Both run as background jobs. */
export const POST = route<P>((ctx, _req, { id, snapshotId }) => snapshotAction(ctx, id, snapshotId, "restore"), { status: 202 });
export const DELETE = route<P>((ctx, _req, { id, snapshotId }) => snapshotAction(ctx, id, snapshotId, "delete"), { status: 202 });
