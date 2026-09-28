import { hash, verify } from "@node-rs/argon2";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Argon2id with OWASP-recommended parameters. */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain: string) => hash(plain, ARGON);
export const verifyPassword = async (hashed: string, plain: string) => {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
};

/** Opaque random token (session id / API key secret). Only its SHA-256 is stored. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function key(): Buffer {
  const k = Buffer.from(process.env.OPENLAB_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("OPENLAB_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

/** AES-256-GCM for secrets at rest (hypervisor credentials, storage secrets). Layout: iv(12) | tag(16) | ciphertext. */
export function encryptSecret(plain: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}

export function decryptSecret(blob: Uint8Array): string {
  const b = Buffer.from(blob);
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
