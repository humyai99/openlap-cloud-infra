import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/** Load .env when present (local dev); CI provides variables directly. */
function readEnv(): Record<string, string> {
  if (!fs.existsSync(".env")) return {};
  return Object.fromEntries(
    fs.readFileSync(".env", "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const env = { ...readEnv(), ...process.env } as Record<string, string>;
// Each run gets its own throwaway database (created and dropped by tests/global-setup.ts),
// so tests never touch dev data and never need a destructive reset.
const runDb = `openlab_test_${Date.now()}`;
const baseUrl = env.TEST_DATABASE_URL ?? env.DATABASE_URL;
const testDb = baseUrl?.replace(/\/[^/?]+(\?|$)/, `/${runDb}$1`);

const testEnv: Record<string, string> = {
  DATABASE_URL: testDb ?? "",
  OPENLAB_ENCRYPTION_KEY: env.OPENLAB_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64"),
  SEED_ADMIN_PASSWORD: "test-admin-password-123",
  OPENLAB_INPROCESS_WORKER: "false",
};
// Applied to this process too, so globalSetup (which runs here, not in a worker) sees the test DB.
Object.assign(process.env, testEnv);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: { ...env, ...testEnv },
  },
});
