# Plan: Fix PUT /users/:id/roles — Verify in Docker

## Context

`PUT /users/:id/roles` is the last untested endpoint in the Docker verification table
(`specs/v1/issues/docker-compose-debug/docker-compose-debug.md`). All other endpoints
have been verified working in Docker. This task follows the same pattern used to
verify `PATCH /users/:id`: run unit tests, build/start Docker, exercise the endpoint
manually, and update the doc.

Code review shows the implementation is correct — no code bugs identified — so the
primary work is test confirmation and Docker E2E verification.

---

## Files Involved

| File | Action |
|---|---|
| `src/routes/users.routes.ts` | Read-only reference |
| `src/services/users.service.ts` | Read-only reference |
| `src/services/__tests__/users.service.test.ts` | Verify tests pass |
| `src/routes/__tests__/users.routes.test.ts` | Verify tests pass |
| `specs/v1/issues/docker-compose-debug/docker-compose-debug.md` | Update status to ✅ |

---

## Implementation Plan

### Step 1 — New branch from main

```bash
git checkout main && git pull
git checkout -b fix/put-users-id-roles
```

### Step 2 — Run unit tests

```bash
npm test
```

Expected: all `updateUserRoles` tests pass (service + route layers).
If any fail, fix and commit before proceeding.

Commit: `test: verify updateUserRoles unit tests pass`

### Step 3 — Docker build & start

```bash
docker compose build app
docker compose up -d
```

(DB + seed are run by the app container entrypoint on startup.)

### Step 4 — Docker E2E verification

> **Note:** `jq` is not available in this environment — use shell variables and raw output.

**4a. Register + login as a regular user**

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
# save the accessToken
```

**4b. Grant admin role directly in DB (user needs `role:write`)**

```bash
# DB credentials: -U user -d iam_db (not -U postgres)
docker compose exec db psql -U user -d iam_db -c \
  "INSERT INTO \"user-service\".user_roles (user_id, role_id)
   SELECT u.id, r.id
   FROM \"user-service\".users u, \"user-service\".roles r
   WHERE u.email = 'admin@example.com' AND r.slug = 'admin'
   ON CONFLICT DO NOTHING;"
```

**4c. Re-login to get token with `role:write` in JWT**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

**4d. Get role IDs from DB**

```bash
docker compose exec db psql -U user -d iam_db -t -c \
  "SELECT id, slug FROM \"user-service\".roles;"
```

**4e. Register a target user to modify roles for**

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"target@example.com","password":"password123"}'
# note the returned id
```

**4f. Call PUT /users/:id/roles**

```bash
curl -s -X PUT http://localhost:3000/users/<TARGET_USER_ID>/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"roleIds":["<ADMIN_ROLE_UUID>"]}'
# Expected: {"success":true}
```

**4g. Verify DB state**

```bash
docker compose exec db psql -U user -d iam_db -t -c \
  "SELECT r.slug FROM \"user-service\".user_roles ur
   JOIN \"user-service\".roles r ON ur.role_id = r.id
   WHERE ur.user_id = '<TARGET_USER_ID>';"
```

**4h. Verify edge cases**

```bash
# 404 — non-existent user
curl -s -X PUT http://localhost:3000/users/00000000-0000-0000-0000-000000000000/roles \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"roleIds":["<ADMIN_ROLE_UUID>"]}'
# Expected: {"success":false,"error":"User not found"}

# 400 — missing roleIds
curl -s -X PUT http://localhost:3000/users/<TARGET_USER_ID>/roles \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400

# 400 — empty roleIds array
curl -s -X PUT http://localhost:3000/users/<TARGET_USER_ID>/roles \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"roleIds":[]}'
# Expected: 400

# 401 — no token
curl -s -X PUT http://localhost:3000/users/<TARGET_USER_ID>/roles \
  -H "Content-Type: application/json" \
  -d '{"roleIds":["<ADMIN_ROLE_UUID>"]}'
# Expected: 401
```

### Step 5 — Update the debug doc

In `specs/v1/issues/docker-compose-debug/docker-compose-debug.md`, change:

```
| `PUT /users/:id/roles` | ❓ Untested | |
```

to:

```
| `PUT /users/:id/roles` | ✅ Working | Verified in Docker — delete+insert transaction confirmed, 404 on unknown user, 400 on missing/empty roleIds, 401 on missing token |
```

Commit: `docs: mark PUT /users/:id/roles as verified working`

### Step 6 — Finish

```bash
# Update CLAUDE.md
# /claude-md-management:revise-claude-md

# Push and PR
git push -u origin fix/put-users-id-roles
gh pr create --title "fix: verify PUT /users/:id/roles in Docker" ...
```

---

## Known Gotchas

- Token TTL is 15m — re-login if expired during testing
- Must re-login after granting admin role (JWT is issued at login time)
- `docker compose build app` is required before `up` after any code changes
- DB credentials: `-U user -d iam_db` (not `-U postgres -d postgres`)
- `jq` is not installed — capture curl output in shell variables instead
- The DB hostname `db` only resolves inside the compose network; use `docker compose exec db psql` for DB queries
