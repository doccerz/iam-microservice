import { index, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";
import { users } from "./users.js";

export const refreshTokens = dbSchema.table(
  "refresh_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar({ length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_refresh_tokens_user_id").on(t.userId)],
);
