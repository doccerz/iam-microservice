# Plan: Fix & Verify PATCH /users/:id

## Context

During the 2026-03-23 Docker debug session (`specs/v1/20260323/.issues/docker-compose-debug.md`), `PATCH /users/:id` was left as `❓ Untested`. Other endpoints revealed Express 5 incompatibilities (e.g. `req.query` readonly → `Object.defineProperty` fix, `req.params.id` type widening). This task verifies the endpoint works end-to-end, adds missing test coverage, and marks it `✅ Working` in the debug doc.

---

## Analysis

**What exists and looks correct:**
- Route (`src/routes/users.routes.ts:39-48`): uses `validate(updateUserSchema)` on `req.body`, `req.params.id as string` (Express 5 type fix already applied), calls `updateUser(id, req.body)`.
- Service (`src/services/users.service.ts:90-120`): transaction-wrapped; fetches user, conditionally updates `users` and `profiles` tables, returns `{ id, email, isActive, updatedAt }`.
- Validator (`src/validators/users.validators.ts`): `updateUserSchema` with `.refine(d => Object.keys(d).length > 0)` — rejects empty body correctly.
- `validate` middleware (`src/middleware/validate.ts:5-16`): assigns `req.body = result.data` — no Express 5 readonly issue (only `req.query` was affected).

**Missing test coverage (gaps identified):**

1. **Service test: "updates profile fields when provided"** (`src/services/__tests__/users.service.test.ts:269-280`):
   - Had unused `mockTx.returning.mockResolvedValueOnce([existingUser])` (no `.returning()` call when only profile fields change). Misleading.
   - Weak assertion: only `expect(mockTx.update).toHaveBeenCalled()`.

2. **Service test: no test for updating BOTH `isActive` and profile fields together** — most realistic real-world call; untested.

---

## What Was Done

### Tests added (`src/services/__tests__/users.service.test.ts`)

Fixed "updates profile fields when provided":
```ts
mockTx.where
  .mockResolvedValueOnce([existingUser]) // 1st: select user
  .mockResolvedValueOnce([]);            // 2nd: update profiles .where()
// removed unused mockTx.returning setup
// added: expect(mockTx.set).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Alice" }))
```

Added new combined-fields test:
```ts
it("updates both users and profiles tables when isActive and profile fields are both provided", async () => {
  mockTx.where
    .mockResolvedValueOnce([existingUser]) // 1st: select user
    .mockReturnValueOnce(mockTx)           // 2nd: update users .where() → chain to .returning()
    .mockResolvedValueOnce([]);            // 3rd: update profiles .where()
  mockTx.returning.mockResolvedValueOnce([updatedUser]);

  const result = await updateUser(validUuid, { isActive: false, firstName: "Alice" });

  expect(mockTx.update).toHaveBeenCalledTimes(2);
  expect(result.isActive).toBe(false);
});
```

**Key mock pattern:** When `where` is called 3 times (select → update chain → second table update), use `mockReturnValueOnce(mockTx)` (not `mockReturnValue`) for the middle call so the persistent default doesn't swallow the terminating call.

### No implementation changes needed
The service code at `src/services/users.service.ts:90-120` correctly handles all cases.

---

## Docker Verification Results

Tested with a user granted the Admin role (which has `user:write`).

| Scenario | Request | Response |
|---|---|---|
| isActive only | `{ "isActive": false }` | 200 `{ id, email, isActive: false, updatedAt }` |
| Profile field only | `{ "firstName": "Alice" }` | 200 `{ id, email, isActive, updatedAt }` |
| Combined | `{ "isActive": true, "firstName": "Bob" }` | 200 — both tables updated |
| Empty body | `{}` | 400 "At least one field must be provided" |
| Nonexistent user | valid UUID, no match | 404 "User not found" |

**GET /users** also verified: pagination, `isActive` filter, and `page`/`limit` params all work correctly.

---

## Operational Notes (Docker)

- Newly registered users only have `user:read`. To test admin endpoints, grant the admin role via DB:
  ```sql
  INSERT INTO "user-service".user_roles (user_id, role_id) VALUES ('<uid>', '<admin-role-id>');
  ```
  Then re-login to get a new token with updated permissions.
- After code changes: `docker compose build app` before `docker compose up -d app` — Compose does not auto-rebuild.
- `npm run db:migrate` / `npm run db:seed` resolve `db` hostname only inside the Docker network; run from host fails. The app entrypoint handles this on startup.

---

## PR

https://github.com/doccerz/user-microservice-js/pull/21
