# Task 2.2: Validation Schemas — Implementation Plan

## Status: Complete

**Branch:** `feat/task-2.2-validation-schemas`
**PR:** https://github.com/doccerz/user-microservice-js/pull/6

---

## Context

Task 2.2 adds the validation layer for the auth routes. Without it, the auth service (Task 2.3) has no input sanitization and Express routes cannot reject malformed requests early.

---

## Files Created

```
src/middleware/
├── __tests__/
│   └── validate.test.ts
└── validate.ts

src/validators/
├── __tests__/
│   └── auth.validators.test.ts
└── auth.validators.ts
```

---

## Implementation

### `src/middleware/validate.ts`

Generic Zod validation middleware factory.

```ts
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/index.js";

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(", ");
      sendError(res, message, 400);
      return;
    }
    req.body = result.data;
    next();
  };
}
```

**Key decisions:**
- `result.error.issues` (not `.errors` — removed in Zod v4)
- `z.ZodTypeAny` as parameter type
- `req.body` replaced with `result.data` so transforms (e.g. lowercased email) propagate downstream
- Reuses `sendError` from utils for consistent response envelope
- Synchronous — no `asyncHandler` needed

### `src/validators/auth.validators.ts`

Zod schemas for all four auth endpoints.

```ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email().transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),   // real check done in service layer
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

**Notes:**
- Zod v4 removed `.toLowerCase()` helper — use `.transform(v => v.toLowerCase())` instead
- `loginSchema.password` uses `min(1)`, not `min(8)` — the service verifies credentials

---

## Zod v4 Compatibility Notes

- Use `result.error.issues` (not `result.error.errors`)
- Use `z.ZodTypeAny` as the base parameter type
- `.toLowerCase()` string helper removed — use `.transform()`
- `.email()` default message is `"Invalid email"`
- `.min(8)` default message is `"String must contain at least 8 character(s)"`

---

## Test Patterns

### `validate.test.ts`
- Requires `vi.mock("../../config/env.js", ...)` to prevent env var errors from the `jwt.ts` transitive import
- Mock setup: `{ status: vi.fn().mockReturnThis(), json: vi.fn() }`
- Key cases: valid body → `next()` called + `req.body` replaced; invalid → 400 + `next()` not called; multiple issues joined; transform output propagated; optional fields absent passes

### `auth.validators.test.ts`
- No mocking needed — Zod is a pure function library
- Use `schema.safeParse(input)` and assert on `result.success`

---

## Commit History

1. `test: add failing tests for Task 2.2 validation schemas`
2. `feat: implement auth validation schemas and validate middleware`
3. `fix: mock env module in validate test to avoid missing env vars`

---

## Verification

```bash
./node_modules/.bin/vitest run
# 98 tests passing (8 validate middleware + 30 auth validators + 60 existing)
```
