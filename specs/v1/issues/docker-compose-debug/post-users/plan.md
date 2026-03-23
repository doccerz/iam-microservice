# Plan: Fix POST /users & Verify in Docker

## Context

`POST /users` is the only endpoint not yet verified end-to-end in Docker (marked `❓ Untested` in `docker-compose-debug.md`). The implementation exists but was never exercised against a live container. This plan verifies the endpoint works, identifies any gaps in test coverage, and updates the debug document to `✅ Working`.

---

## Branch

Create from `main`: `fix/post-users-verify`

---

## Step 1 — Run existing tests (read-only check)

```bash
npm test
```

Confirm no failures in:
- `src/routes/__tests__/users.routes.test.ts` (POST / suite)
- `src/services/__tests__/users.service.test.ts` (createUser suite)
- `src/validators/__tests__/users.validators.test.ts` (createUserSchema suite)

If `dist/` stale files cause noise: `rm -rf dist/` first.

---

## Step 2 — Identify and fix any gaps

Based on exploration, one uncovered edge case exists:

**Missing test: invalid `roleId` (non-existent UUID) → should surface as 500 or a meaningful error**

The service inserts into `user_roles` which has a FK on `roles.id`. A non-existent UUID causes a raw Postgres FK violation → uncaught → error handler returns 500 with `"Internal server error"`. This is acceptable behavior (no fix needed), but the test gap should be assessed.

If no code bugs are found → no implementation changes. Only tests/docs.

---

## Step 3 — Git commit tests (if any added)

```
git add src/.../users.*.test.ts
git commit -m "test: cover edge cases for POST /users"
```

---

## Step 4 — Docker end-to-end verification

### 4a. Rebuild & start containers

```bash
docker compose build app
docker compose up -d
```

### 4b. Register a user (will become admin)

```bash
# jq is not installed — use raw curl output
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
```

### 4c. Grant admin role in DB

```bash
# psql shorthand: docker compose exec db psql -U user -d iam_db
# Schema tables need quoting: "user-service".<table>

docker compose exec db psql -U user -d iam_db -c \
  "SELECT id FROM \"user-service\".roles WHERE slug='admin';"

docker compose exec db psql -U user -d iam_db -c \
  "SELECT id FROM \"user-service\".users WHERE email='admin@test.com';"

docker compose exec db psql -U user -d iam_db -c \
  "INSERT INTO \"user-service\".user_roles (user_id, role_id) VALUES ('<user-id>', '<admin-role-id>');"
```

### 4d. Login to get access token (with user:write permission)

```bash
# Capture token from raw output manually (jq not available)
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

TOKEN="<accessToken from response>"
```

### 4e. POST /users — happy path

```bash
curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "newuser@test.com",
    "password": "password123",
    "firstName": "New",
    "roleIds": ["<role-id>"]
  }'
```

Expected: `{ "success": true, "data": { "id": "...", "email": "newuser@test.com", "createdAt": "..." } }` with HTTP 201.

### 4f. Conflict test

Re-send same payload → expect `{ "success": false, "error": "Email already in use" }` with HTTP 409.

### 4g. Unauthorized test

Send without Bearer token → expect 401.

### 4h. Validation test

Send with `roleIds: []` → expect 400.

---

## Step 5 — Update debug document

File: `specs/v1/issues/docker-compose-debug/docker-compose-debug.md`

Change:
```
| `POST /users` | ❓ Untested | Requires `user:write` permission |
```
To:
```
| `POST /users` | ✅ Working | Admin token required; roleIds must be valid UUIDs from roles table; 409 on duplicate email |
```

Commit:
```
git commit -m "docs: mark POST /users as verified working"
```

---

## Step 6 — Push & PR

```bash
git push -u origin fix/post-users-verify
gh pr create --title "fix: verify POST /users end-to-end in Docker" ...
```

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/routes/users.routes.ts:17-26` | Route — authenticate → authorize("user:write") → validate → createUser |
| `src/services/users.service.ts:13-39` | createUser — transaction: check duplicate, hash pw, insert user+profile+roles |
| `src/validators/users.validators.ts:3-10` | createUserSchema — email, password, optional name/avatar, roleIds (min 1 UUID) |
| `src/routes/__tests__/users.routes.test.ts:83-123` | Route tests for POST / |
| `src/services/__tests__/users.service.test.ts:88-157` | Service tests for createUser |
| `specs/v1/issues/docker-compose-debug/docker-compose-debug.md` | Debug doc to update |

---

## Reusable Patterns to Follow

- `asyncHandler` wrapping in route (already used)
- `ConflictError` thrown from service (already used)
- `sendSuccess(res, data, 201)` for 201 response (already used)
- `vi.hoisted()` + chainable `mockTx` for transaction mocking (already used in service tests)
- `getHandler(method, path)` + `await Promise.resolve()` flush for route tests (already used)
