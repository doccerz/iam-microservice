# Docker Compose Debug Session — 2026-03-23

## Issues Fixed

### 1. Test files included in TypeScript build
- **File:** `tsconfig.json`
- **Fix:** Added `"src/**/__tests__/**"` and `"src/**/*.test.ts"` to `exclude`
- **Root cause:** `tsc` compiled test files, causing type errors from mock/stub code

### 2. `expiresIn` type mismatch in `jwt.ts`
- **File:** `src/utils/jwt.ts`
- **Fix:** Cast options as `unknown as jwt.SignOptions`
- **Root cause:** `@types/jsonwebtoken@9.0.10` uses `ms.StringValue` (branded template literal) for `expiresIn`, not plain `string`

### 3. `req.query` assignment type error in `validate.ts`
- **File:** `src/middleware/validate.ts`
- **Fix:** `req.query = result.data as typeof req.query`
- **Root cause:** Zod `ZodTypeAny` infers `result.data` as `unknown`; Express `req.query` is `ParsedQs`

### 4. `req.params.id` typed as `string | string[]`
- **File:** `src/routes/users.routes.ts`
- **Fix:** Added `as string` cast on `req.params.id`
- **Root cause:** `@types/express@5` changed `ParamsDictionary` to `{ [key: string]: string | string[] }`

### 5. `drizzle/` folder missing in Docker build
- **File:** `Dockerfile`
- **Fix:** Added `COPY drizzle/ ./drizzle/` to the builder stage
- **Root cause:** Builder stage only copied `src/`, but runtime stage tried to copy `/app/drizzle` from builder

### 6. Migration fails with "schema already exists"
- **File:** `src/db/migrate.ts`
- **Fix:** Removed `migrationsSchema: env.DATABASE_SCHEMA` from `migrate()` options
- **Root cause:** Drizzle pre-creates the `migrationsSchema` for its journal table; the migration SQL itself also runs `CREATE SCHEMA "user-service"` → conflict on every startup

---

## Endpoints Tested

| Endpoint | Status | Notes |
|---|---|---|
| `POST /auth/register` | ✅ Working | Returns `{ success, data: { id, email, createdAt } }` |
| `POST /auth/login` | ✅ Working | Returns `accessToken` + `refreshToken` |
| `POST /auth/refresh` | ✅ Working | Field name is `token`, not `refreshToken` |
| `POST /auth/change-password` | ✅ Working | Returns `{ success: true }` |
| `GET /users` | ❌ 500 Internal Server Error | See open issue below |
| `PATCH /users/:id` | ❓ Untested | |
| `PUT /users/:id/roles` | ❓ Untested | |
| `POST /users` | ❓ Untested | Requires `user:write` permission |

---

## Open Issue: `GET /users` returns 500

### Symptoms
- `GET /users?page=1&limit=10` with a valid `user:read` JWT returns `{"success":false,"error":"Internal server error"}`
- Calling `listUsers({ page: 1, limit: 10 })` directly inside the container succeeds
- The error handler (`src/middleware/error-handler.ts`) does NOT log the actual error — only returns the generic message

### Findings
- The service layer works correctly in isolation
- The issue is somewhere in the Express middleware chain (authenticate → authorize → validateQuery → handler)
- Suspect: `validateQuery` replacing `req.query` with parsed data (numbers) may cause an issue downstream, or there's a subtle error being thrown in the route handler that isn't visible without error logging

### Next Steps
1. Add `console.error(err)` to `error-handler.ts` before the 500 response, rebuild, and check container logs
2. Or add a try/catch directly in the route handler to log the exact error
3. Check if `req.query` mutation in `validateQuery` has side effects in Express 5

---

## Notes
- `POST /auth/refresh` field name is `token` (not `refreshToken`) per `refreshSchema` in `src/validators/auth.validators.ts`
- Access token TTL is 15m — tokens expire quickly during testing
- Default seed creates a `user` role with `user:read` permission; newly registered users only get `user:read`
