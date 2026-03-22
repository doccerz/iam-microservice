# Testing Patterns

**File organization:** `src/<layer>/__tests__/<module>.test.ts`

## Universal env mock

Required in every test file that imports anything touching `env`:

```ts
vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    DATABASE_URL: "postgres://localhost/test",
    DATABASE_SCHEMA: "public",
    PORT: "3000",
    DEFAULT_ROLE_SLUG: "user",
  },
}));
```

## `vi.hoisted()` for mock references

When a mock fn is referenced in both `vi.mock(...)` and test bodies:

```ts
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}));
vi.mock("../../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/index.js")>();
  return { ...actual, verifyAccessToken: mockVerifyAccessToken };
});
```

## Mock req/res helpers

Local factory functions in each test file:

```ts
function mockReq(overrides = {}) {
  return { headers: {}, body: {}, user: undefined, ...overrides } as unknown as Request;
}
function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
}
```

## Chainable DB mock

For service tests; re-apply `mockReturnThis()` in `beforeEach` after `vi.resetAllMocks()`:

```ts
const mockWhere = vi.fn().mockResolvedValue([]);
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: mockWhere,
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
};
vi.mock("../../db/index.js", () => ({ db: mockDb }));
```

## Route handler extraction

For route tests without an HTTP server:

```ts
type RouteLayer = { route: { path: string; stack: { method: string; handle: Function }[] } };
function getHandler(method: string, path: string) {
  const layer = (router as unknown as { stack: RouteLayer[] }).stack
    .find(l => l.route?.path === path && l.route.stack.some(s => s.method === method));
  const handlers = layer?.route.stack.filter(s => s.method === method);
  return handlers?.[handlers.length - 1]?.handle; // last handler = skips validate middleware
}
// After calling an async handler, flush the asyncHandler microtask:
await Promise.resolve();
```

**Gotcha:** Filter by method in the `find` predicate, not just path. When `POST /` and `GET /` both exist, `find` without the method check returns the first match and the GET handler comes back `undefined`.

## Sequential DB mock calls (e.g. count + data query)

When a service makes two queries on the same chain (e.g. `listUsers` does a count then a data query), sequence with `mockResolvedValueOnce` + `mockReturnValue`:

```ts
mockWhere
  .mockResolvedValueOnce([{ total: 3 }])  // 1st call: terminates (count query)
  .mockReturnValue(mockDb);               // 2nd call: chains forward (data query)
mockOffset.mockResolvedValueOnce([...rows]);
```

## Transaction mock — chaining through `.returning()`

When a transaction has `select` then `update().set().where().returning()`, `mockTx.where` must chain back to `mockTx` after the first resolve:

```ts
mockTx.where
  .mockResolvedValueOnce([existingRow])  // 1st call: select terminates
  .mockReturnValue(mockTx);              // 2nd call: update chain → .returning()
mockTx.returning.mockResolvedValueOnce([updatedRow]);
```

## Describe structure

Nested `describe` per exported function; `beforeEach` with `vi.clearAllMocks()`; type assertions via `expectTypeOf`.
