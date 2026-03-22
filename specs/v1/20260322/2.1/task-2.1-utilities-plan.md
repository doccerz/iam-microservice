# Task 2.1: Utilities Implementation Plan

## Context

Phase 2 (Authentication Core) begins with creating the utility layer that all subsequent auth/middleware/service code depends on. Currently `src/utils/` does not exist. We need 5 utility modules + barrel export, following TDD workflow per CLAUDE.md.

## Branch

`feat/task-2.1-utilities` (from `main`)

## Implementation Order

Ordered by dependency chain — errors first (used by jwt), then independent modules.

### 1. `src/utils/errors.ts`

```ts
export class AppError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
export class ConflictError extends AppError { constructor(msg = "Conflict") { super(msg, 409); } }
export class UnauthorizedError extends AppError { constructor(msg = "Unauthorized") { super(msg, 401); } }
export class ForbiddenError extends AppError { constructor(msg = "Forbidden") { super(msg, 403); } }
export class NotFoundError extends AppError { constructor(msg = "Not Found") { super(msg, 404); } }
```

**Tests** (`src/utils/__tests__/errors.test.ts`):
- Each class sets correct `statusCode`, `message`, `name`
- All are `instanceof AppError` and `instanceof Error`
- Custom messages override defaults

### 2. `src/utils/password.ts`

```ts
import argon2 from "argon2";
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

**Tests** (`src/utils/__tests__/password.test.ts`): Mock `argon2`.
- `hashPassword` calls `argon2.hash` with argon2id type
- `verifyPassword` returns true/false based on `argon2.verify`
- Errors propagate

### 3. `src/utils/jwt.ts`

Uses `env` from `src/config/env.ts`, `JwtPayload` from `src/types/index.ts`, `UnauthorizedError` from `./errors.ts`.

- `signAccessToken(payload: JwtPayload): string` — signs with `JWT_ACCESS_SECRET`, `expiresIn: JWT_ACCESS_EXPIRY`
- `signRefreshToken(payload: { sub: string }): string` — signs with `JWT_REFRESH_SECRET`, `expiresIn: JWT_REFRESH_EXPIRY`
- `verifyAccessToken(token: string): JwtPayload` — verifies, strips JWT metadata (iat/exp), throws `UnauthorizedError` on failure
- `verifyRefreshToken(token: string): { sub: string }` — verifies, returns `{ sub }`, throws `UnauthorizedError` on failure

**Tests** (`src/utils/__tests__/jwt.test.ts`): Mock `jsonwebtoken` and `../../config/env.js`.
- Sign functions call `jwt.sign` with correct secret/expiry
- Verify functions return clean payload on success
- Verify functions throw `UnauthorizedError` when `jwt.verify` throws

### 4. `src/utils/response.ts`

Uses `ApiResponse<T>` from `src/types/index.ts`.

- `sendSuccess<T>(res, data?, statusCode=200)` — sends `{ success: true, data }`
- `sendError(res, message, statusCode=500)` — sends `{ success: false, error: message }`

**Tests** (`src/utils/__tests__/response.test.ts`): Mock Express `Response`.
- Correct status codes and JSON shape
- `sendSuccess` omits `data` field when undefined
- Custom status codes work

### 5. `src/utils/async-handler.ts`

```ts
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
export const asyncHandler = (fn: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
```

**Tests** (`src/utils/__tests__/async-handler.test.ts`): Mock req/res/next.
- Calls wrapped function with req, res, next
- On rejection, calls `next` with the error
- On success, does not call `next` with error

### 6. `src/utils/index.ts` (barrel)

Re-exports all 5 modules. No dedicated tests needed.

## Critical Files

- `src/config/env.ts` — JWT secrets/expiry (mock in tests)
- `src/types/index.ts` — `JwtPayload`, `ApiResponse<T>`
- `src/db/__tests__/seed.test.ts` — Reference for mocking patterns (vi.mock with `.js` extensions)

## Git Workflow

1. Create branch `feat/task-2.1-utilities` from `main`
2. Write all 5 test files → commit: `test: add failing tests for Task 2.1 utility modules`
3. Implement all 6 source files → commit: `feat: add utility modules (errors, password, jwt, response, async-handler)`
4. Run tests, fix if needed → commit fixes
5. Push + create PR to `main`

## Verification

```bash
npx vitest run src/utils/    # All utility tests pass
npx vitest run               # No regression in existing tests
```
