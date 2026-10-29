// Local PostgreSQL without Docker: `npm run db:local`
// Data lives in ./.pgdata (git-ignored). Matches the DATABASE_URL in .env.example
// when PG_PORT is 5433. Use docker-compose.yml instead if you have Docker.
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.PG_PORT ?? 5433);
const databaseDir = path.resolve(process.cwd(), ".pgdata");
const isNew = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "tint",
  password: "tint",
  port,
  persistent: true,
  onLog: () => {},
});

if (isNew) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("tint_shop");
} catch {
  // already exists
}
console.log(`PostgreSQL ready: postgresql://tint:tint@localhost:${port}/tint_shop`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
