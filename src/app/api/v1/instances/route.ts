import { createInstance, listInstances } from "@/lib/server/instances";
import { route } from "@/lib/server/http";
import { createInstanceSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async (ctx, req) => {
  const type = req.nextUrl.searchParams.get("type");
  return listInstances(ctx, type === "vm" || type === "container" ? type : undefined);
});

/** Enqueues provisioning; returns 202 with the job to poll. */
export const POST = route(async (ctx, req) => createInstance(ctx, createInstanceSchema.parse(await req.json())), { status: 202 });
