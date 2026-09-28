import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const ORIGIN = "http://localhost:3000";
let ipSeq = 0;
/** Each request gets its own client IP so rate-limit buckets don't leak between tests. */
function req(path: string, init: { method?: string; headers?: Record<string, string>; cookie?: boolean; ip?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", init.ip ?? `10.99.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}`);
  if (init.cookie) headers.set("cookie", "openlab_session=abc");
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? "GET", headers });
}

describe("auth gate", () => {
  it("redirects pages to /login with ?next", () => {
    const res = proxy(req("/vms"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fvms`);
  });

  it("lets the login page through without a session", () => {
    expect(proxy(req("/login")).status).toBe(200);
  });

  it("returns 401 JSON for API calls without credentials", async () => {
    const res = proxy(req("/api/v1/instances"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("passes requests that carry a session cookie", () => {
    expect(proxy(req("/vms", { cookie: true })).status).toBe(200);
  });
});

describe("CSRF", () => {
  it("blocks cookie-authenticated POSTs without an Origin", () => {
    expect(proxy(req("/api/v1/instances", { method: "POST", cookie: true })).status).toBe(403);
  });

  it("blocks cross-site origins", () => {
    expect(proxy(req("/api/v1/instances", { method: "DELETE", cookie: true, headers: { origin: "https://evil.example" } })).status).toBe(403);
  });

  it("allows same-origin requests", () => {
    expect(proxy(req("/api/v1/instances", { method: "POST", cookie: true, headers: { origin: ORIGIN } })).status).toBe(200);
  });

  it("does not apply to Bearer API-key requests (no ambient credentials)", () => {
    expect(proxy(req("/api/v1/instances", { method: "POST", headers: { authorization: "Bearer olk_x.y" } })).status).toBe(200);
  });

  it("GETs don't need an Origin", () => {
    expect(proxy(req("/api/v1/instances", { cookie: true })).status).toBe(200);
  });
});

describe("rate limiting", () => {
  it("allows 10 login attempts per minute per IP, then 429 with Retry-After", () => {
    const ip = "203.0.113.7";
    const attempt = () => proxy(req("/api/v1/auth/login", { method: "POST", ip, headers: { origin: ORIGIN } }));
    for (let i = 0; i < 10; i++) expect(attempt().status).toBe(200);
    const blocked = attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits are per IP", () => {
    expect(proxy(req("/api/v1/auth/login", { method: "POST", ip: "203.0.113.8", headers: { origin: ORIGIN } })).status).toBe(200);
  });
});

describe("security headers & matcher", () => {
  it("sets CSP and anti-framing headers", () => {
    const h = proxy(req("/login")).headers;
    expect(h.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(h.get("x-frame-options")).toBe("DENY");
    expect(h.get("x-content-type-options")).toBe("nosniff");
  });

  it("never runs on Next internals (HMR websocket, static chunks)", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/_next/hmr")).toBe(false);
    expect(re.test("/_next/static/chunks/a.js")).toBe(false);
    expect(re.test("/dashboard")).toBe(true);
    expect(re.test("/api/v1/instances")).toBe(true);
  });
});
