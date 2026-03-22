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
  delete: vi.fn().mockReturnThis(),
};
vi.mock("../../db/index.js", () => ({ db: mockDb }));
```

## Route handler extraction

For route tests without an HTTP server:

```ts
type RouteLayer = { route: { path: string; stack: { method: string; handle: Function }[] } };
function getHandler(method: string, path: string) {
  const layer = (router as unknown as { stack: RouteLayer[] }).stack
    .find(l => l.route?.path === path);
  const handlers = layer?.route.stack.filter(s => s.method === method);
  return handlers?.[handlers.length - 1]?.handle; // last handler = skips validate middleware
}
// After calling an async handler, flush the asyncHandler microtask:
await Promise.resolve();
```

## Describe structure

Nested `describe` per exported function; `beforeEach` with `vi.clearAllMocks()`; type assertions via `expectTypeOf`.
