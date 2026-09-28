import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, randomToken, safeEqual, sha256, verifyPassword } from "@/lib/server/crypto";

describe("AES-256-GCM secrets", () => {
  const original = process.env.OPENLAB_ENCRYPTION_KEY;
  afterEach(() => {
    process.env.OPENLAB_ENCRYPTION_KEY = original;
  });

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("incus-client-cert");
    const b = encryptSecret("incus-client-cert");
    expect(a.equals(b)).toBe(false);
    expect(decryptSecret(a)).toBe("incus-client-cert");
    expect(a.includes(Buffer.from("incus-client-cert"))).toBe(false);
  });

  it("detects tampering", () => {
    const blob = encryptSecret("secret");
    blob[blob.length - 1] ^= 0xff;
    expect(() => decryptSecret(blob)).toThrow();
  });

  it("rejects a key that isn't 32 bytes", () => {
    process.env.OPENLAB_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});

describe("passwords & tokens", () => {
  it("Argon2id hashes verify and never contain the plaintext", async () => {
    const h = await hashPassword("correct-horse-42");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(h).not.toContain("correct-horse-42");
    expect(await verifyPassword(h, "correct-horse-42")).toBe(true);
    expect(await verifyPassword(h, "wrong-horse-42")).toBe(false);
  });

  it("verifyPassword returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });

  it("tokens are unique and sha256 is 64 hex chars", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
    expect(sha256("x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("safeEqual compares correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
