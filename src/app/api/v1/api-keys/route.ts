import { audit } from "@/lib/server/audit";
import { AuthError } from "@/lib/server/auth";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { apiKeySchema } from "@/lib/validation/instance";

export const dynamic = "force-dynamic";

export const GET = route(async ({ principal }) =>
  db.apiKey.findMany({
    where: { userId: principal.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  }),
);

/** Creates a key. The full secret is returned exactly once; only its SHA-256 is stored. */
export const POST = route(async ({ principal, ip }, req) => {
  if (principal.via === "api_key") throw new AuthError(403, "API keys cannot mint new API keys");
  const input = apiKeySchema.parse(await req.json());
  const prefix = `olk_${randomToken(6)}`;
  const secret = `${prefix}.${randomToken(32)}`;
  const key = await db.apiKey.create({
    data: {
      userId: principal.userId,
      name: input.name,
      prefix,
      secretHash: sha256(secret),
      scopes: input.scopes,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
    },
  });
  await audit({ userId: principal.userId, action: "Created API key", resourceType: "api_key", resourceId: key.id, resourceName: `${input.name} (${prefix})`, ip, result: "success" });
  return { id: key.id, name: key.name, prefix, secret };
}, { status: 201 });
