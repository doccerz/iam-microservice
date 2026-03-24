import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "../config/env.js";
import { db, sql } from "./index.js";
import { logger } from "../utils/logger.js";

export async function runMigrations(): Promise<void> {
  logger.info("Running migrations...");
  await migrate(db, {
    migrationsFolder: "./drizzle",
    migrationsSchema: env.DATABASE_SCHEMA,
  });
  logger.info("Migrations complete.");
}

if (require.main === module) {
  runMigrations()
    .then(() => sql.end())
    .catch((err) => {
      logger.error("Migration failed:", err);
      process.exit(1);
    });
}
