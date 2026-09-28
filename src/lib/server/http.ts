import "server-only";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { ApiError } from "@/lib/types";
import { AuthError, requireApiUser } from "./auth";
import type { Ctx } from "./instances";
import { ServiceError } from "./instances";

export function clientIp(req: NextRequest | Request): string {
  // Behind Nginx/Traefik the proxy sets X-Forwarded-For; the left-most entry is the client.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
}

const fail = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json<ApiError>({ error: { code, message, details } }, { status });

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) return fail(422, "VALIDATION", err.issues[0]?.message ?? "Invalid input", err.issues);
  if (err instanceof AuthError) return fail(err.status, err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", err.message);
  if (err instanceof ServiceError) return fail(err.status, err.code, err.message);
  if (err instanceof SyntaxError) return fail(400, "BAD_JSON", "Request body is not valid JSON");
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return fail(409, "CONFLICT", "A resource with that name already exists");
    if (err.code === "P2023" || err.code === "P2025") return fail(404, "NOT_FOUND", "Resource not found");
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return fail(503, "DB_UNAVAILABLE", "The database is unreachable. Check that PostgreSQL is running.");
  console.error(err);
  return fail(500, "INTERNAL", "Something went wrong. Please try again.");
}

type Handler<P> = (ctx: Ctx, req: NextRequest, params: P) => Promise<unknown>;

/**
 * Wraps an API handler: authenticates (session cookie or API key), builds the
 * request context and maps errors to the JSON error envelope.
 */
export function route<P = Record<string, never>>(handler: Handler<P>, opts: { status?: number } = {}) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    try {
      const principal = await requireApiUser();
      const data = await handler({ principal, ip: clientIp(req) }, req, await params);
      return NextResponse.json({ data }, { status: opts.status ?? 200 });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
