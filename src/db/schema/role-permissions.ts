import { primaryKey, uuid } from "drizzle-orm/pg-core";
import { dbSchema } from "./schema.js";
import { roles } from "./roles.js";
import { permissions } from "./permissions.js";

export const rolePermissions = dbSchema.table(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
