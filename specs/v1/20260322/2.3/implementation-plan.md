# Task 2.3: Auth Service (register, login)

## Context

Task 2.2 (validation schemas + validate middleware) is complete. Task 2.3 implements the core auth business logic: `register` and `login` functions in `src/services/auth.service.ts`. This is the first service layer file — it wires together the DB, utilities, and types established in prior tasks.

---

## Branch

Create from `main`: `feat/task-2.3-auth-service`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/__tests__/auth.service.test.ts` | Failing tests (written first) |
| `src/services/auth.service.ts` | Implementation |

---

## Step 1: Write Failing Tests

**File:** `src/services/__tests__/auth.service.test.ts`

Mock strategy (mirrors `validate.test.ts` pattern):
- `vi.mock("../../config/env.js", ...)` — standard env mock
- `vi.mock("../../db/index.js", ...)` — mock `db` with chainable Drizzle API
- `vi.mock("../../utils/password.js", ...)` — mock `hashPassword`/`verifyPassword`
- `vi.mock("../../utils/jwt.js", ...)` — mock `signAccessToken`/`signRefreshToken`

**Mock `db` shape** — use `vi.hoisted()` to define mocks before `vi.mock()` factories; `values` always `mockReturnThis()` so `.returning()` can chain; use `vi.resetAllMocks()` in `beforeEach` (not `clearAllMocks`) to prevent queue bleed between tests:

```typescript
const { mockDb, mockWhere, mockReturning, mockTx } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();
  const mockTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: mockWhere,
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockReturning,
  };
  const mockDb = { transaction: vi.fn(), ...mockTx };
  return { mockDb, mockWhere, mockReturning, mockTx };
});
```

**`register` tests:**
1. Returns `{id, email, createdAt}` on success (no existing email, default role found)
2. Throws `ConflictError` when email already exists
3. Calls `hashPassword` before inserting user
4. Still inserts user when default role is not found

**`login` tests:**
1. Returns `{accessToken, refreshToken, user}` on success
2. Throws `UnauthorizedError` when user not found
3. Throws `UnauthorizedError` when user is inactive (`isActive: false`)
4. Throws `UnauthorizedError` when password is wrong (verifyPassword returns false)
5. Stores refresh token in DB on success
6. Signs access token with `sub`, `email`, and permissions
7. Signs refresh token with `sub` only

**`getUserPermissions` tests:**
1. Returns flat array of permission slugs for a user
2. Returns empty array when user has no permissions

---

## Step 2: Implement `src/services/auth.service.ts`

### Imports

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users, profiles, roles, userRoles,
  rolePermissions, permissions, refreshTokens,
} from "../db/schema/index.js";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { ConflictError, UnauthorizedError } from "../utils/errors.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validators.js";
```

### `getUserPermissions(userId: string): Promise<string[]>`

Reusable helper (also needed by Task 3.3 refresh endpoint):

```typescript
const rows = await db
  .select({ slug: permissions.slug })
  .from(userRoles)
  .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
  .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
  .where(eq(userRoles.userId, userId));
return rows.map((r) => r.slug);
```

### `register(data: RegisterInput)`

Inside a single `db.transaction(async (tx) => { ... })`:
1. `tx.select().from(users).where(eq(users.email, email))` → throw `ConflictError` if row found
2. `hashPassword(password)` → `passwordHash`
3. `tx.insert(users).values({ email, passwordHash }).returning()` → `user`
4. `tx.insert(profiles).values({ userId: user.id, firstName, lastName })`
5. `tx.select().from(roles).where(eq(roles.slug, env.DEFAULT_ROLE_SLUG))` → `defaultRole`
6. If role found: `tx.insert(userRoles).values({ userId: user.id, roleId: defaultRole.id })`
7. Return `{ id: user.id, email: user.email, createdAt: user.createdAt }`

### `login(data: LoginInput)`

1. `db.select().from(users).where(eq(users.email, email))` → throw `UnauthorizedError("Invalid credentials")` if not found or `!user.isActive`
2. `verifyPassword(password, user.passwordHash)` → throw `UnauthorizedError("Invalid credentials")` if false
3. `getUserPermissions(user.id)` → `userPermissions`
4. `signAccessToken({ sub: user.id, email: user.email, permissions: userPermissions })`
5. `signRefreshToken({ sub: user.id })`
6. Compute `expiresAt` from `env.JWT_REFRESH_EXPIRY` using a local `parseExpiry()` helper
7. `db.insert(refreshTokens).values({ userId, token, expiresAt })`
8. Return `{ accessToken, refreshToken, user: { id: user.id, email: user.email } }`

### `parseExpiry(expiry: string): number` (private helper)

Converts strings like `"7d"`, `"15m"`, `"1h"` to milliseconds. Supports `d`, `h`, `m`, `s` suffixes.

---

## Commit Sequence

1. `test: add failing tests for Task 2.3 auth service`
2. `feat: implement auth service (register, login, getUserPermissions)`

---

## Verification

```bash
npm test -- src/services/__tests__/auth.service.test.ts
```

All 13 tests pass. No DB connection needed (fully mocked).

## PR

https://github.com/doccerz/user-microservice-js/pull/7
