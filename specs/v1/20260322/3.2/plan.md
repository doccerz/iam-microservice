# Task 3.2: Permission Guard (`src/middleware/authorize.ts`)

## Context
Task 3.1 (JWT authentication middleware) is complete. Task 3.2 builds on it by adding authorization — a higher-order middleware factory that checks whether the authenticated user holds the required permission slugs (from `req.user.permissions`). This gate is used by all protected routes in Phase 4.

---

## Branch
`feat/task-3.2-permission-guard` (created from `main`)

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/middleware/__tests__/authorize.test.ts` | Create — failing tests first |
| `src/middleware/authorize.ts` | Create — implementation |
| `specs/v1/implementation-plan.md` | Edit — mark task 3.2 `[x]` |

---

## Implementation

**`src/middleware/authorize.ts`**
```typescript
import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/index.js";

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Not authenticated"));
      return;
    }
    const hasAll = requiredPermissions.every(p => req.user!.permissions.includes(p));
    if (!hasAll) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }
    next();
  };
}
```

Key points:
- `authorize(...requiredPermissions)` — variadic, mirrors the plan spec
- Guards against missing `req.user` (401) — defensive in case used without `authenticate`
- Uses `.every()` — ALL listed permissions must be present
- Throws `ForbiddenError` (403) on missing permissions

---

## Test Cases (`src/middleware/__tests__/authorize.test.ts`)

Follow pattern from `authenticate.test.ts` (Vitest, mock req/res/next):

1. `req.user` is undefined → `next(UnauthorizedError)`
2. User has all required permissions → `next()` (no error)
3. User is missing one of two required permissions → `next(ForbiddenError)`
4. User has no permissions, one required → `next(ForbiddenError)`
5. `authorize()` called with zero required permissions → `next()` (always passes)
6. Multiple required permissions all present → `next()`

Mock pattern (no module mocks needed — no external deps):
```typescript
function mockReq(permissions: string[]): Partial<Request> & { user: JwtPayload } {
  return { user: { sub: "u1", email: "a@b.com", permissions } };
}
```

---

## Workflow (per CLAUDE.md)

1. `git checkout main && git checkout -b feat/task-3.2-permission-guard`
2. Write failing tests → `git commit`
3. Implement `authorize.ts` → `git commit`
4. Run `npm test` — ensure all pass → fix if needed → `git commit`
5. Mark `[x]` in `specs/v1/implementation-plan.md` → `git commit`
6. Push branch → create PR to main

---

## Verification

```bash
npm test -- src/middleware/__tests__/authorize.test.ts
```

All 6 test cases should pass. No integration test needed — pure unit test of middleware function.
