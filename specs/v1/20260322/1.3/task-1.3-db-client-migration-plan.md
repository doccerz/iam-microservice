# Task 1.3: DB Client + Migration Runner

## Context

Tasks 1.1 (schema) and 1.2 (types) are done. The database schema tables, relations, and env config all exist. Task 1.3 creates the Drizzle client singleton and migration runner script — foundational pieces that all subsequent phases (services, seed, routes) depend on.

## Files to Create

| File | Purpose |
|------|---------|
| `src/db/__tests__/db.test.ts` | Unit tests (written first) |
| `src/db/index.ts` | Drizzle client singleton |
| `src/db/migrate.ts` | Migration runner script |

## Dependencies (existing, read-only)

- `src/config/env.ts` — provides `DATABASE_URL`, `DATABASE_SCHEMA`
- `src/db/schema/index.ts` — barrel export of all 7 tables + `dbSchema`
- `src/db/relations.ts` — all Drizzle relation definitions
- `drizzle.config.ts` — `out: "./drizzle"` (migrations folder)

---

## Implementation

### `src/db/index.ts` — Drizzle Client

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";
import * as relations from "./relations.js";

const fullSchema = { ...schema, ...relations };

export const db = drizzle(env.DATABASE_URL, { schema: fullSchema });
export const sql = db.$client;
```

Key points:
- `schema` must include both tables AND relations for `db.query.*` relational API to work
- `sql` (raw postgres.js client) is exported for connection cleanup (migrate script, graceful shutdown)
- Type: `db` is `PostgresJsDatabase<typeof fullSchema>`

### `src/db/migrate.ts` — Migration Runner

```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "../config/env.js";
import { db, sql } from "./index.js";

export async function runMigrations(): Promise<void> {
  console.log("Running migrations...");
  await migrate(db, {
    migrationsFolder: "./drizzle",
    migrationsSchema: env.DATABASE_SCHEMA,
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
```

Key points:
- `migrationsFolder: "./drizzle"` matches `drizzle.config.ts` `out` field
- `migrationsSchema: env.DATABASE_SCHEMA` puts the `__drizzle_migrations` tracking table in the app schema, not `public`
- `require.main === module` guard makes it testable (function can be imported without auto-executing)
- `sql.end()` closes the connection pool so the process exits cleanly

---

## Test Strategy (`src/db/__tests__/db.test.ts`)

Mock-based unit tests — no real database needed.

### db/index.ts tests
- Mock `drizzle-orm/postgres-js` and `../../config/env.js`
- Verify `db` is the drizzle return value
- Verify `sql` is `db.$client`
- Verify drizzle was called with `env.DATABASE_URL` and schema containing all tables + relations

### db/migrate.ts tests
- Mock `../index.js` (db, sql), `drizzle-orm/postgres-js/migrator` (migrate), `../../config/env.js`
- Import and call `runMigrations()`
- Verify `migrate` called with correct `migrationsFolder` and `migrationsSchema`

### Mocking notes
- `vi.mock()` with `.js` extensions (matching actual import paths) — vitest handles this
- `vi.mock()` is hoisted, preventing `env.ts` dotenv side effect and `schema.ts` env access

---

## Workflow

1. Create branch `feat/task-1.3-db-client-migration` from current branch
2. Write `src/db/__tests__/db.test.ts` with failing tests → **commit**
3. Implement `src/db/index.ts` → **commit**
4. Implement `src/db/migrate.ts` → **commit**
5. Run `npm test`, fix if needed → **commit**
6. Push branch, create PR to `main`

## Verification

- `npm test` — all tests pass
- `npx tsc --noEmit` — no type errors
