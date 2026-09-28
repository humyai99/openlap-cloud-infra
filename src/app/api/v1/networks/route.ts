import { audit } from "@/lib/server/audit";
import { assertPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { ServiceError } from "@/lib/server/instances";
import { queries } from "@/lib/server/queries";
import { networkSchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async () => queries.networks());

export const POST = route(async ({ principal, ip }, req) => {
  assertPermission(principal, "network.manage");
  const n = networkSchema.parse(await req.json());
  if (await db.network.findFirst({ where: { name: n.name, projectId: null, deletedAt: null } })) {
    throw new ServiceError("NAME_TAKEN", `Network "${n.name}" already exists`, 409);
  }
  const net = await db.network.create({
    data: {
      name: n.name, type: n.type.toUpperCase() as "BRIDGE", bridge: n.bridge, vlanId: n.vlanId, dns: n.dns, createdBy: principal.userId,
      subnets: { create: { cidr: n.cidr, ipVersion: 4, gateway: n.gateway, dhcpStart: n.dhcpStart || null, dhcpEnd: n.dhcpEnd || null, createdBy: principal.userId } },
    },
  });
  await audit({ userId: principal.userId, action: "Created network", resourceType: "network", resourceId: net.id, resourceName: n.name, ip, result: "success" });
  return { id: net.id };
}, { status: 201 });
