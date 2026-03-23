# Task 4.3: Users Service & Routes

## Context

Task 4.3 is the final feature task before containerization. It implements the full admin user management surface: creating users with roles, listing/filtering users (paginated), patching user profiles/status, and replacing user role assignments. These endpoints are protected by existing `authenticate` + `authorize` middleware.

## Branch

```
git checkout main && git pull
git checkout -b feat/task-4.3-users-service-routes
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/validators/users.validators.ts` | Zod schemas + Input types |
| `src/services/users.service.ts` | Business logic |
| `src/routes/users.routes.ts` | Express router |
| `src/validators/__tests__/users.validators.test.ts` | Validator tests |
| `src/services/__tests__/users.service.test.ts` | Service tests |
| `src/routes/__tests__/users.routes.test.ts` | Route tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/middleware/validate.ts` | Add `validateQuery` export (parses `req.query`) |
| `src/app.ts` | Mount users router at `/users` |

---

## Step 1: Validators (`src/validators/users.validators.ts`)

```ts
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  avatarUrl: z.string().trim().url().optional(),
  roleIds: z.array(z.string().uuid()).min(1),
});

export const listUsersSchema = z.object({
  isActive: z.string().optional().transform((v) =>
    v === undefined ? undefined : v === "true"
  ),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  avatarUrl: z.string().trim().url().optional(),
  isActive: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
```

**Key decisions:**
- `isActive` uses string transform (not `z.coerce.boolean()`) because Express query params are strings and coerce would turn `"false"` → `true`
- `avatarUrl` validates as URL
- `updateUserSchema` uses `.refine()` to reject empty PATCH bodies
- `listUsersSchema.page/limit` use `z.coerce.number()` since query params are strings

---

## Step 2: Extend `validate.ts` — Add `validateQuery`

Add after the existing `validate` function in `src/middleware/validate.ts`:

```ts
export function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(", ");
      sendError(res, message, 400);
      return;
    }
    req.query = result.data;
    next();
  };
}
```

Identical to `validate` except parses `req.query` instead of `req.body`.

---

## Step 3: Service (`src/services/users.service.ts`)

**Imports needed:** `db` from `../db/index.js`, `users, profiles, userRoles, roles` from `../db/schema/index.js`, `eq, and, count` from `drizzle-orm`, `hashPassword` from `../utils/password.js`, `ConflictError, NotFoundError` from `../utils/errors.js`, input types from validators.

### `createUser(data: CreateUserInput)`

```
db.transaction(async (tx) => {
  1. Check email uniqueness → throw ConflictError if exists
  2. hashPassword(data.password)
  3. tx.insert(users).values({ email, passwordHash }).returning() → [user]
  4. tx.insert(profiles).values({ userId: user.id, firstName, lastName, avatarUrl })
  5. tx.insert(userRoles).values(roleIds.map(roleId => ({ userId: user.id, roleId })))
  6. return { id: user.id, email: user.email, createdAt: user.createdAt }
})
```

### `listUsers(filters: ListUsersInput)`

```
// Build optional where clause
const conditions = [];
if (filters.isActive !== undefined) conditions.push(eq(users.isActive, filters.isActive));
const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

// Count query
const [{ total }] = await db.select({ total: count() }).from(users).where(whereClause);

// Data query with left join on profiles
const offset = (filters.page - 1) * filters.limit;
const rows = await db
  .select({ id, email, isActive, createdAt, firstName, lastName, avatarUrl })
  .from(users)
  .leftJoin(profiles, eq(profiles.userId, users.id))
  .where(whereClause)
  .limit(filters.limit)
  .offset(offset);

return {
  users: rows,
  pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / filters.limit) }
};
```

Note: `leftJoin` ensures users without profile rows still appear.

### `updateUser(id: string, data: UpdateUserInput)`

```
db.transaction(async (tx) => {
  1. Fetch user → throw NotFoundError if not found
  2. If isActive !== undefined → tx.update(users).set({ isActive }).where(eq(users.id, id)).returning()
  3. If any profile fields → tx.update(profiles).set({ firstName, lastName, avatarUrl }).where(eq(profiles.userId, id))
  4. return { id, email, isActive, updatedAt } from returning() result
})
```

Use `.returning()` on the users update to avoid a second SELECT.

### `updateUserRoles(userId: string, data: UpdateUserRolesInput)`

```
1. Verify user exists → throw NotFoundError if not found
2. db.transaction(async (tx) => {
     tx.delete(userRoles).where(eq(userRoles.userId, userId))
     tx.insert(userRoles).values(roleIds.map(roleId => ({ userId, roleId })))
   })
```

Replace strategy: delete all then re-insert.

---

## Step 4: Routes (`src/routes/users.routes.ts`)

```ts
router.post("/",
  authenticate, authorize("user:write"), validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    sendSuccess(res, user, 201);
  })
);

router.get("/",
  authenticate, authorize("user:read"), validateQuery(listUsersSchema),
  asyncHandler(async (req, res) => {
    const result = await listUsers(req.query as unknown as ListUsersInput);
    sendSuccess(res, result);
  })
);

router.patch("/:id",
  authenticate, authorize("user:write"), validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id, req.body);
    sendSuccess(res, user);
  })
);

router.put("/:id/roles",
  authenticate, authorize("role:write"), validate(updateUserRolesSchema),
  asyncHandler(async (req, res) => {
    await updateUserRoles(req.params.id, req.body);
    sendSuccess(res);
  })
);
```

---

## Step 5: Mount in `src/app.ts`

```ts
import usersRouter from "./routes/users.routes.js";
// ...
app.use("/users", usersRouter);
app.use(errorHandler);   // errorHandler stays last
```

---

## Test Structure

### `src/validators/__tests__/users.validators.test.ts`
No env mock needed. Four `describe` blocks (one per schema):
- `createUserSchema`: valid input, email normalization, trim, missing/invalid fields, empty roleIds
- `listUsersSchema`: defaults applied, coercion of page/limit, isActive string→boolean transform
- `updateUserSchema`: partial inputs, reject empty body, invalid avatarUrl
- `updateUserRolesSchema`: valid UUIDs, empty array rejection

### `src/services/__tests__/users.service.test.ts`

Mock structure (vi.hoisted pattern from auth.service.test.ts):
```ts
const { mockDb, mockWhere, mockReturning, mockTx, mockOffset } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();
  const mockOffset = vi.fn();

  const mockTx = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: mockWhere, insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(),
    returning: mockReturning, update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  const mockDb = {
    transaction: vi.fn(),
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: mockWhere, leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(),
    returning: mockReturning, delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), offset: mockOffset,
  };

  return { mockDb, mockWhere, mockReturning, mockTx, mockOffset };
});
```

For `listUsers` tests, use `mockResolvedValueOnce` to sequence two calls:
```ts
// count query terminates at where, data query terminates at offset
mockWhere
  .mockResolvedValueOnce([{ total: 3 }])   // 1st call: count query
  .mockReturnValue(mockDb);                 // 2nd call: data query continues to .limit().offset()
mockOffset.mockResolvedValueOnce([...rows]);
```

Describe blocks: `createUser`, `listUsers`, `updateUser`, `updateUserRoles` — covering happy paths + error cases (ConflictError, NotFoundError).

### `src/routes/__tests__/users.routes.test.ts`

Follow `auth.routes.test.ts` pattern exactly. Mock `../../services/users.service.js`.
- `makeReqRes` takes `{ body?, query?, params? }` to support GET and parameterised routes
- `getHandler("post"|"get"|"patch"|"put", "/"|"/:id"|"/:id/roles")` — gets last handler (skips middleware)
- `await Promise.resolve()` after calling each async handler
- Covers: success cases (201/200), error propagation via `next`

---

## Git Commit Sequence

1. Write all 3 failing test files → `test(task-4.3): add failing tests for users validators, service, and routes`
2. Implement validators → `feat(task-4.3): add users validators`
3. Add `validateQuery` to validate.ts → `feat(task-4.3): add validateQuery middleware`
4. Implement service → `feat(task-4.3): implement users service`
5. Implement routes + mount in app.ts → `feat(task-4.3): add users routes and mount in app`
6. Fix any failing tests → `fix(task-4.3): fix test failures`
7. Mark task done in implementation-plan.md → `docs(task-4.3): mark task complete in implementation plan`
8. Push + create PR to main

---

## Verification

```bash
npm test   # all tests pass
```

Manual smoke test (with running DB):
```bash
# Admin token required for all endpoints
POST /users        { email, password, roleIds: [...] }  → 201
GET  /users        ?isActive=true&page=1&limit=10       → 200 with pagination
PATCH /users/:id   { firstName: "Alice" }               → 200
PUT  /users/:id/roles { roleIds: [...] }                → 200
GET  /users        without token                        → 401
GET  /users        with non-admin token                 → 403
```
