/**
 * Local PostgreSQL without Docker (dev only): `npm run db:local`.
 * Uses the embedded-postgres package (official PostgreSQL binaries) and keeps
 * data in ./.pgdata. Credentials come from POSTGRES_PASSWORD in .env.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".pgdata");
const password = process.env.POSTGRES_PASSWORD;
if (!password) throw new Error("Set POSTGRES_PASSWORD in .env");

const pg = new EmbeddedPostgres({ databaseDir: dir, user: "openlab", password, port: 5432, persistent: true,
  // Force UTF-8 regardless of the Windows code page (e.g. WIN874 on Thai Windows).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const fresh = !existsSync(join(dir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("openlab");
  console.log("[db:local] PostgreSQL ready on 127.0.0.1:5432 (db: openlab). Ctrl+C to stop.");
}

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
main().catch(async (e) => {
  console.error(e);
  await stop();
});
