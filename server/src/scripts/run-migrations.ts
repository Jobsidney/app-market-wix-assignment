import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../migrations");

async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    create table if not exists schema_migrations (
      file_name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function run(): Promise<void> {
  await ensureMigrationsTable();
  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const fileName of files) {
    const exists = await db.query("select 1 from schema_migrations where file_name = $1", [fileName]);
    if (exists.rowCount) {
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
    await db.query("begin");
    try {
      await db.query(sql);
      await db.query("insert into schema_migrations (file_name) values ($1)", [fileName]);
      await db.query("commit");
      logger.info({ fileName }, "Migration applied");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  logger.info("Migrations complete");
  await db.end();
}

void run();
