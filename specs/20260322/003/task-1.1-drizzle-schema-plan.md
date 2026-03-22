# Task 1.1: Drizzle Schema (7 tables)

## Context

Phase 0 is complete — dependencies installed, `env.ts`, `drizzle.config.ts`, and `tsconfig.json` are configured. No files exist in `src/db/` yet. This task creates the 7 RBAC table definitions, a barrel export, and Drizzle relations.

`drizzle.config.ts` expects the schema entry point at `./src/db/schema/index.ts`. Module resolution is `NodeNext` (imports need `.js` extensions). All tables must use `pgSchema(env.DATABASE_SCHEMA)` (value: `"user-service"`) instead of `pgTable`.

## Files to Create (in order)

### 1. `src/db/schema/schema.ts` — Shared pgSchema instance

```ts
import { pgSchema } from "drizzle-orm/pg-core";
import { env } from "../../config/env.js";

export const dbSchema = pgSchema(env.DATABASE_SCHEMA);
```

### 2. `src/db/schema/users.ts`

| Column | Definition |
|--------|-----------|
| id | `uuid().primaryKey().defaultRandom()` |
| email | `varchar({ length: 255 }).notNull().unique()` |
| passwordHash | `varchar("password_hash", { length: 255 }).notNull()` |
| isActive | `boolean("is_active").notNull().default(true)` |
| createdAt | `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()` |
| updatedAt | `timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())` |

### 3. `src/db/schema/profiles.ts`

| Column | Definition |
|--------|-----------|
| id | uuid PK defaultRandom |
| userId | `uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" })` |
| firstName | `varchar("first_name", { length: 100 })` — nullable |
| lastName | `varchar("last_name", { length: 100 })` — nullable |
| avatarUrl | `varchar("avatar_url", { length: 500 })` — nullable |

### 4. `src/db/schema/roles.ts`

| Column | Definition |
|--------|-----------|
| id | uuid PK defaultRandom |
| name | `varchar({ length: 100 }).notNull()` |
| slug | `varchar({ length: 100 }).notNull().unique()` |
| createdAt | timestamp with tz, defaultNow |

### 5. `src/db/schema/permissions.ts`

| Column | Definition |
|--------|-----------|
| id | uuid PK defaultRandom |
| slug | `varchar({ length: 100 }).notNull().unique()` |
| description | `varchar({ length: 255 })` — nullable |
| createdAt | timestamp with tz, defaultNow |

### 6. `src/db/schema/role-permissions.ts` — Junction, composite PK

| Column | Definition |
|--------|-----------|
| roleId | `uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" })` |
| permissionId | `uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" })` |

Extra config: `(t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]`

### 7. `src/db/schema/user-roles.ts` — Junction, composite PK

| Column | Definition |
|--------|-----------|
| userId | `uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| roleId | `uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" })` |

Extra config: `(t) => [primaryKey({ columns: [t.userId, t.roleId] })]`

### 8. `src/db/schema/refresh-tokens.ts`

| Column | Definition |
|--------|-----------|
| id | uuid PK defaultRandom |
| userId | `uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| token | `varchar({ length: 500 }).notNull().unique()` |
| expiresAt | `timestamp("expires_at", { withTimezone: true }).notNull()` |
| createdAt | timestamp with tz, defaultNow |

Extra config: `(t) => [index("idx_refresh_tokens_user_id").on(t.userId)]`

### 9. `src/db/schema/index.ts` — Barrel export

Re-export `*` from all 8 files above (schema.ts + 7 tables).

### 10. `src/db/relations.ts` — Drizzle relations

Import `relations` from `"drizzle-orm"` and all tables from `"./schema/index.js"`.

| Relation object | Definitions |
|----------------|-------------|
| usersRelations | one→profiles, many→userRoles, many→refreshTokens |
| profilesRelations | one→users (fields: userId, ref: users.id) |
| rolesRelations | many→rolePermissions, many→userRoles |
| permissionsRelations | many→rolePermissions |
| rolePermissionsRelations | one→roles, one→permissions |
| userRolesRelations | one→users, one→roles |
| refreshTokensRelations | one→users |

## Key patterns

- Every table file: import column types from `drizzle-orm/pg-core`, import `dbSchema` from `./schema.js`
- Use `dbSchema.table("table_name", { columns }, (t) => [...extras])` — NOT `pgTable`
- `.js` extensions on all relative imports (NodeNext module resolution)
- `primaryKey` and `index` imported from `drizzle-orm/pg-core`

## Verification

1. Run `npx tsc --noEmit` — should compile with no errors
2. Run `npm run db:generate` (requires `.env` file) — should generate migration SQL in `./drizzle/`
3. Inspect generated SQL to confirm tables are in the `"user-service"` schema with correct columns, FKs, indexes, and composite PKs
