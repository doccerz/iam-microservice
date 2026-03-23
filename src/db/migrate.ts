import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "../config/env.js";
import { db, sql } from "./index.js";

export async function runMigrations(): Promise<void> {
  console.log("Running migrations...");
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });
  console.log("Migrations complete.");
}

if (require.main === module) {
  runMigrations()
    .then(() => sql.end())
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
