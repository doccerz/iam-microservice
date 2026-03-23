# Task 3.1: JWT Validation Middleware

## Context

Phase 3 begins with the `authenticate` middleware. All protected routes (users CRUD, change-password, etc.) need a reusable middleware that validates the Bearer access token and attaches the decoded `JwtPayload` to `req.user`. Without this, no route can be protected.

---

## Branch

Created from `main`: `feat/task-3.1-jwt-auth-middleware`

---

## What to Build

**File:** `src/middleware/authenticate.ts`

Logic:
1. Read `Authorization` header
2. If missing or not `Bearer <token>` format → `next(new UnauthorizedError("No token provided"))`
3. Call `verifyAccessToken(token)` — already throws `UnauthorizedError` on bad/expired tokens
4. On success: set `req.user = decoded`, call `next()`
5. On `verifyAccessToken` throw: pass error to `next(err)` so the global error handler responds 401

```ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, UnauthorizedError } from "../utils/index.js";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("No token provided"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
```

---

## Test File

**File:** `src/middleware/__tests__/authenticate.test.ts`

Mock strategy:
- `vi.hoisted()` to define `mockVerifyAccessToken` before `vi.mock()` factories
- `vi.mock("../../config/env.js", ...)` — prevent env load
- `vi.mock("../../utils/index.js", async (importOriginal) => { ...actual, verifyAccessToken: mockVerifyAccessToken })` — mock via barrel (source imports from `utils/index.js`)

Test cases:
| Case | Expected |
|------|----------|
| Missing `Authorization` header | `next(UnauthorizedError)` called |
| Header without `Bearer ` prefix | `next(UnauthorizedError)` called |
| `verifyAccessToken` throws `UnauthorizedError` | `next(err)` called with that error |
| Valid token | `req.user` populated, `next()` called with no args |
| Valid token payload shape | `req.user` equals decoded payload |

---

## Reused Utilities

- `verifyAccessToken()` — `src/utils/jwt.ts:30` (already throws `UnauthorizedError`)
- `UnauthorizedError` — `src/utils/errors.ts:17`
- `JwtPayload` type — `src/types/index.ts:39`
- `req.user` augmentation — `src/types/express.d.ts`

---

## Verification

```bash
npm run test   # 116 tests pass across 13 test files
```

Manual smoke test (after integration):
```bash
curl -X GET http://localhost:3000/users
# → 401 { "success": false, "error": "No token provided" }

curl -X GET http://localhost:3000/users -H "Authorization: Bearer invalid"
# → 401 { "success": false, "error": "Invalid or expired access token" }
```

## PR

https://github.com/doccerz/user-microservice-js/pull/10
