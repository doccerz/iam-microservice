# Docker Compose Debug Session — 2026-03-23

## Issues Fixed

- [x] **1. Test files included in TypeScript build**
  - **File:** `tsconfig.json`
  - **Fix:** Added `"src/**/__tests__/**"` and `"src/**/*.test.ts"` to `exclude`
  - **Root cause:** `tsc` compiled test files, causing type errors from mock/stub code

- [x] **2. `expiresIn` type mismatch in `jwt.ts`**
  - **File:** `src/utils/jwt.ts`
  - **Fix:** Cast options as `unknown as jwt.SignOptions`
  - **Root cause:** `@types/jsonwebtoken@9.0.10` uses `ms.StringValue` (branded template literal) for `expiresIn`, not plain `string`

- [x] **3. `req.query` assignment type error in `validate.ts`**
  - **File:** `src/middleware/validate.ts`
  - **Fix:** `req.query = result.data as typeof req.query`
  - **Root cause:** Zod `ZodTypeAny` infers `result.data` as `unknown`; Express `req.query` is `ParsedQs`

- [x] **4. `req.params.id` typed as `string | string[]`**
  - **File:** `src/routes/users.routes.ts`
  - **Fix:** Added `as string` cast on `req.params.id`
  - **Root cause:** `@types/express@5` changed `ParamsDictionary` to `{ [key: string]: string | string[] }`

- [x] **5. `drizzle/` folder missing in Docker build**
  - **File:** `Dockerfile`
  - **Fix:** Added `COPY drizzle/ ./drizzle/` to the builder stage
  - **Root cause:** Builder stage only copied `src/`, but runtime stage tried to copy `/app/drizzle` from builder

- [x] **6. Migration fails with "schema already exists"**
  - **File:** `src/db/migrate.ts`
  - **Fix:** Removed `migrationsSchema: env.DATABASE_SCHEMA` from `migrate()` options
  - **Root cause:** Drizzle pre-creates the `migrationsSchema` for its journal table; the migration SQL itself also runs `CREATE SCHEMA "user-service"` → conflict on every startup

- [x] **7. `GET /users` returns 500**
  - **File:** `src/middleware/validate.ts`, `src/middleware/error-handler.ts`
  - **Fix:** Used `Object.defineProperty` to override `req.query` (Express 5 getter-only accessor); added `console.error(err)` logging to error handler
  - **Root cause:** Express 5 makes `req.query` a non-writable getter on the prototype; direct assignment threw a silent `TypeError` in strict mode, caught by the error handler which returned a generic 500

---

## Endpoints Tested

| Endpoint | Status | Notes |
|---|---|---|
| `POST /auth/register` | ✅ Working | Returns `{ success, data: { id, email, createdAt } }` |
| `POST /auth/login` | ✅ Working | Returns `accessToken` + `refreshToken` |
| `POST /auth/refresh` | ✅ Working | Field name is `token`, not `refreshToken` |
| `POST /auth/change-password` | ✅ Working | Returns `{ success: true }` |
| `GET /users` | ✅ Working | Verified in Docker — `Object.defineProperty` fix confirmed working |
| `PATCH /users/:id` | ✅ Working | Verified in Docker — isActive, profile fields, combined, empty-body 400, 404 all correct |
| `PUT /users/:id/roles` | ✅ Working | Verified in Docker — delete+insert transaction confirmed, 404 on unknown user, 400 on missing/empty roleIds, 401 on missing token |
| `POST /users` | ❓ Untested | Requires `user:write` permission |

---

---

## Notes
- `POST /auth/refresh` field name is `token` (not `refreshToken`) per `refreshSchema` in `src/validators/auth.validators.ts`
- Access token TTL is 15m — tokens expire quickly during testing
- Default seed creates a `user` role with `user:read` permission; newly registered users only get `user:read`
- To test admin endpoints: grant admin role in DB directly — `INSERT INTO "user-service".user_roles (user_id, role_id) VALUES ('<uid>', '<admin-role-id>')`; then re-login
- After code changes, always `docker compose build app` before `docker compose up -d app` — Compose does not auto-rebuild on source changes
- `npm run db:migrate` / `npm run db:seed` must run from inside Docker network (hostname `db` only resolves inside the compose network); the app container's entrypoint handles this on startup
