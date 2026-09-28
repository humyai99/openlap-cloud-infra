import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/audit";
import { createSession } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { clientIp, errorResponse } from "@/lib/server/http";
import { loginSchema } from "@/lib/validation/instance";

// Compared against when the email is unknown, so response time doesn't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  try {
    const { email, password } = loginSchema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(user?.passwordHash ?? (await (dummyHash ??= hashPassword("not-a-real-password"))), password);
    if (!user || !ok || user.status !== "ACTIVE" || user.deletedAt) {
      await audit({ userId: user?.id ?? null, action: "Sign in", resourceName: email, ip, result: "failure" });
      return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }, { status: 401 });
    }
    await createSession(user.id, ip, req.headers.get("user-agent"));
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ userId: user.id, action: "Sign in", resourceName: email, ip, result: "success" });
    return NextResponse.json({ data: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return errorResponse(e);
  }
}
