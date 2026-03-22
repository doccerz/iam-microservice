import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";

export const roles = dbSchema.table("roles", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull(),
  slug: varchar({ length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
