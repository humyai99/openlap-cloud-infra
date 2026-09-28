import { deleteQuota } from "@/lib/server/admin";
import { route } from "@/lib/server/http";

export const DELETE = route<{ id: string }>((ctx, _req, { id }) => deleteQuota(ctx, id));
