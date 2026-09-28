import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge of the app (Next.js 16 "proxy", formerly middleware):
 *  - Auth gate: pages require a session cookie (the session itself is verified server-side).
 *  - CSRF: state-changing /api requests authenticated by cookie must come from our own origin.
 *    SameSite=Lax cookies + Origin check; Bearer API-key requests carry no ambient credentials.
 *  - Rate limiting: fixed window per client IP (per process; use Redis/Traefik for multi-instance).
 *  - Security headers incl. CSP.
 */
const SESSION_COOKIES = ["openlab_session", "__Host-openlab_session"];
const PUBLIC_PATHS = ["/login", "/api/v1/auth/login"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const LIMITS = { login: { max: 10, windowMs: 60_000 }, api: { max: 300, windowMs: 60_000 } };
const g = globalThis as unknown as { __rl?: Map<string, { n: number; reset: number }> };
const buckets = (g.__rl ??= new Map());

function rateLimited(key: string, { max, windowMs }: { max: number; windowMs: number }) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return null;
  }
  b.n++;
  return b.n > max ? Math.ceil((b.reset - now) / 1000) : null;
}

function withSecurityHeaders(res: NextResponse) {
  const dev = process.env.NODE_ENV !== "production";
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!dev) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

const json = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  withSecurityHeaders(NextResponse.json({ error: { code, message } }, { status, headers }));

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
  const bearer = req.headers.get("authorization")?.startsWith("Bearer ");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (isApi) {
    const isLogin = pathname === "/api/v1/auth/login";
    const retry = rateLimited(`${isLogin ? "login" : "api"}:${ip}`, isLogin ? LIMITS.login : LIMITS.api);
    if (retry) return json(429, "RATE_LIMITED", `Too many requests. Try again in ${retry}s.`, { "Retry-After": String(retry) });

    if (MUTATING.has(req.method) && !bearer) {
      const origin = req.headers.get("origin");
      const expected = req.nextUrl.origin;
      const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const ok = origin && (origin === expected || (fwdHost && new URL(origin).host === fwdHost));
      if (!ok) return json(403, "CSRF", "Cross-site request blocked");
    }
    if (!PUBLIC_PATHS.includes(pathname) && !hasSession && !bearer) return json(401, "UNAUTHENTICATED", "Sign in required");
    return withSecurityHeaders(NextResponse.next());
  }

  if (!PUBLIC_PATHS.includes(pathname) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
