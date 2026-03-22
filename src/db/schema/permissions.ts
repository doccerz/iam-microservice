import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";

export const permissions = dbSchema.table("permissions", {
  id: uuid().primaryKey().defaultRandom(),
  slug: varchar({ length: 100 }).notNull().unique(),
  description: varchar({ length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
