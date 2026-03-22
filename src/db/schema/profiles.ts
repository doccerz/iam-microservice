import { uuid, varchar } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";
import { users } from "./users.js";

export const profiles = dbSchema.table("profiles", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
});
