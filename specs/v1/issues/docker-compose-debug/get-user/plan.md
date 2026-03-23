# Fix: GET /users returns 500

## Context

`GET /users?page=1&limit=10` with a valid `user:read` JWT returns `{"success":false,"error":"Internal server error"}`, even though calling `listUsers(...)` directly succeeds. The error handler has no `console.error`, so the actual error is invisible.

**Root cause:** `tsconfig.json` has `"strict": true`, so compiled JS runs in strict mode. In Express 5, `req.query` is defined as a getter-only accessor property on the prototype (via `Object.defineProperty`). Strict mode throws a `TypeError` when you assign to a getter-only property:

```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

This throw happens inside the synchronous `validateQuery` middleware, Express catches it and forwards to `errorHandler`, which returns 500 without logging. The `listUsers` service is never reached.

**Secondary issue:** `errorHandler` swallows the actual error silently — `console.error` is missing.

---

## Changes

### 1. `src/middleware/error-handler.ts`
Add `console.error(err)` before the 500 response so unexpected errors are logged:

```ts
// before the 500 fallback:
console.error(err);
res.status(500).json({ success: false, error: "Internal server error" });
```

### 2. `src/middleware/validate.ts`
Replace the direct property assignment with `Object.defineProperty` to shadow the prototype getter on the instance:

```ts
// OLD (throws in strict mode with Express 5 getter):
req.query = result.data as typeof req.query;

// NEW (creates own property on req instance, bypasses prototype getter):
Object.defineProperty(req, "query", {
  value: result.data,
  writable: true,
  configurable: true,
  enumerable: true,
});
```

No changes to the route handler (`req.query as unknown as ListUsersInput` cast stays as-is).

---

## Tests

### `src/middleware/__tests__/validate.test.ts`
Add `validateQuery` describe block (import `validateQuery` alongside `validate`):

- **valid query with coercion** — parsed numbers/booleans land on `req.query` and `next()` is called
- **invalid query** — returns 400, `next()` not called
- **isActive transform** — `"true"` → `true`, `"false"` → `false`, absent → `undefined`

### `src/middleware/__tests__/error-handler.test.ts`
Add a test verifying `console.error` is called on non-AppError (spy with `vi.spyOn(console, "error")`).

---

## Execution Order (per git workflow)

```
checkout main && pull
→ create branch: fix/get-users-500-validatequery
→ write failing tests (validateQuery + console.error spy)
→ git commit (failing tests)
→ implement fixes (error-handler + validate)
→ git commit (implementation)
→ run tests, fix if needed
→ git commit (fixes)
→ update CLAUDE.md (/claude-md-management:revise-claude-md)
→ push + create PR to main
```

---

## Verification

After implementation:
1. Run unit tests: `npm test`
2. `docker compose up --build`
3. Run other endpoints when there are dependencies to run next step
4. `GET /users?page=1&limit=10` with valid JWT → should return `{ success: true, data: { users: [...], pagination: {...} } }` (not 500)
5. Confirm container logs show no uncaught errors

## Critical files

| File | Change |
|---|---|
| `src/middleware/validate.ts` | `Object.defineProperty` instead of direct assignment |
| `src/middleware/error-handler.ts` | Add `console.error(err)` |
| `src/middleware/__tests__/validate.test.ts` | Add `validateQuery` tests |
| `src/middleware/__tests__/error-handler.test.ts` | Add console.error spy test |
