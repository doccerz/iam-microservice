import { primaryKey, uuid } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";
import { users } from "./users.js";
import { roles } from "./roles.js";

export const userRoles = dbSchema.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);
