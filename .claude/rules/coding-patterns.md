# Coding Patterns

## Implementation Patterns

- Transactions for multi-table mutations (register, role updates)
- `asyncHandler` wrapper for Express route error propagation
- Custom `AppError` subclasses (ConflictError, UnauthorizedError, ForbiddenError, NotFoundError)
- `onConflictDoNothing()` for idempotent seeding
- Reusable `getUserPermissions(userId)` for login + refresh flows

## Error Handling

- `AppError(message, statusCode)` — base class in `src/utils/errors.ts`; subclasses: `ConflictError` (409), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404)
- Services throw typed errors: `throw new ConflictError("Email already in use")`
- Middleware passes errors: `next(new UnauthorizedError(...))` — never `res.status().json()` from service code
- Error handler (`src/middleware/error-handler.ts`): `instanceof AppError` → `err.statusCode`, else 500. Always responds `{ success: false, error: string }`

## Response Format

- Success: `{ success: true, data?: T }` — Error: `{ success: false, error: string }`
- `sendSuccess(res, data?, statusCode = 200)` — used in route handlers only
- `sendError(res, message, statusCode)` — used **only** in `validate` middleware for 400s; error handler writes `res.status().json()` directly
- `ApiResponse<T>` generic type defined in `src/types/index.ts`

## Middleware Chain Pattern

```ts
// Public route
router.post("/path", validate(schema), asyncHandler(async (req, res) => { ... }))

// Protected route
router.get("/path", authenticate, authorize("resource:action"), asyncHandler(...))
```

- `authenticate` — extracts `Bearer` token, sets `req.user`, calls `next(err)` on failure
- `authorize(...permissions)` — factory; AND-logic check of all perms against `req.user.permissions`; `authorize()` with no args always passes
- `validate(schema)` — factory; calls `sendError` + returns (no `next`) on failure; replaces `req.body` with transformed data on success

## Service Layer

- Plain `async function` exports (not classes)
- Accept `XxxInput` types from `z.infer<typeof xyzSchema>` — not raw `Request`
- Throw `AppError` subclasses for domain errors — never return error objects
- Multi-table mutations: `db.transaction(async (tx) => { ... })` — use `tx` not `db` inside
- Return explicit plain objects, not full Drizzle row types
- Export reusable helpers (e.g., `getUserPermissions` used by both `login` and `refresh`)

## Database Query Patterns

```ts
// First-row destructuring (check undefined after)
const [row] = await db.select().from(table).where(eq(table.id, id));
if (!row) throw new NotFoundError();

// Insert and return
const [created] = await tx.insert(table).values(data).returning();

// Idempotent seed insert
await db.insert(table).values(data).onConflictDoNothing();

// Joined query — no intermediate variables
await db.select().from(a).innerJoin(b, eq(a.id, b.aId)).innerJoin(c, eq(b.cId, c.id)).where(...);
```

## Validation (Zod)

```ts
// src/validators/auth.validators.ts pattern
export const registerSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;
```

- Transforms (`.trim()`, `.toLowerCase()`) applied at schema level — not in services
- `loginSchema` uses `z.string().min(1)` for password (no strength check)
- Optional fields: `.optional()` not `.nullable()`
- One file per domain: `auth.validators.ts`, `users.validators.ts`

## TypeScript Type Patterns

- Drizzle entity types: `InferSelectModel<typeof table>` → `User`; `InferInsertModel<typeof table>` → `NewUser`
- Express augmentation in `src/types/express.d.ts`: adds `user?: JwtPayload` to `Express.Request`
- `JwtPayload`: `{ sub: string, email: string, permissions: string[] }`
- Services accept `XxxInput` types — never `req: Request`

## Module/Import Conventions

- All imports use `.js` extension in TypeScript source (ESM interop, even in commonjs project)
- `src/utils/index.ts` — barrel re-exports all utils; middleware imports from `../utils/index.js`
- `src/db/schema/index.ts` — barrel for all table definitions
- No cross-layer skipping: routes → middleware → services → db

## Permission Slug Convention

- Format: `resource:action` (e.g., `user:read`, `user:write`, `user:delete`, `role:read`, `role:write`)
- Same slugs used in DB, JWT payload, and `authorize(...)` args
