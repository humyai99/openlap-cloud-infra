import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Creates a fresh, uniquely named database for this test run (migrate deploy + seed)
 * and drops it afterwards. Only databases named openlab_test_<digits> are ever dropped,
 * so existing data is never touched.
 */
const RUN_DB = /^openlab_test_\d+$/;

function dbName(url: string) {
  return url.split("/").pop()?.split("?")[0] ?? "";
}

function run(cmd: string) {
  try {
    execSync(cmd, { stdio: "pipe", env: process.env });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`"${cmd}" failed:\n${err.stderr?.toString() ?? ""}${err.stdout?.toString() ?? ""}`);
  }
}

export default function setup() {
  const url = process.env.DATABASE_URL ?? "";
  const name = dbName(url);
  if (!RUN_DB.test(name)) throw new Error(`Refusing to use "${name || "(none)"}" as a test database.`);
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");

  return async function teardown() {
    const admin = new PrismaClient({ datasources: { db: { url: url.replace(/\/[^/?]+(\?|$)/, "/postgres$1") } } });
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    } finally {
      await admin.$disconnect();
    }
  };
}
