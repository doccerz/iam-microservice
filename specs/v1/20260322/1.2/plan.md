# Task 1.2: TypeScript Types (`src/types/`)

## Context

Task 1.1 (Drizzle schema for 7 RBAC tables) is complete. Task 1.2 creates the shared TypeScript types needed by all subsequent phases — Drizzle-derived entity types, JWT payload, API response envelope, and Express augmentation. No test framework exists yet, so we need to install one to follow the test-first workflow.

## Files to Create

### `src/types/index.ts`
- **Drizzle-derived types** using `InferSelectModel` / `InferInsertModel` from `drizzle-orm` for all 7 tables:
  - `User` / `NewUser` (from `users`)
  - `Profile` / `NewProfile` (from `profiles`)
  - `Role` / `NewRole` (from `roles`)
  - `Permission` / `NewPermission` (from `permissions`)
  - `RolePermission` / `NewRolePermission` (from `rolePermissions`)
  - `UserRole` / `NewUserRole` (from `userRoles`)
  - `RefreshToken` / `NewRefreshToken` (from `refreshTokens`)
- **`JwtPayload`** interface: `{ sub: string; email: string; permissions: string[] }`
- **`ApiResponse<T>`** interface: `{ success: boolean; data?: T; error?: string }`

### `src/types/express.d.ts`
- Augment Express `Request` interface to add `user?: JwtPayload`
- Uses declaration merging on `Express` namespace

## Test Setup (prerequisite)

Install vitest as dev dependency:
```bash
npm install -D vitest
```

Add test script to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### `src/types/__tests__/types.test.ts`
Tests to write (compile-time + runtime checks):
- Verify `JwtPayload` has required fields (`sub`, `email`, `permissions`)
- Verify `ApiResponse<T>` generic works with success/error shapes
- Verify Drizzle-inferred types exist and have expected properties (e.g., `User` has `id`, `email`, `passwordHash`, `isActive`)
- Verify `NewUser` omits auto-generated fields appropriately
- Verify Express `Request` augmentation compiles (import express Request, assign `user` property)

## Execution Workflow (per CLAUDE.md)

1. **Install vitest**, add test scripts to `package.json` — commit
2. **Write failing tests** in `src/types/__tests__/types.test.ts` — commit
3. **Implement** `src/types/index.ts` and `src/types/express.d.ts` — commit
4. **Run tests**, fix if needed — commit
5. **Push** branch, **create PR** to main

## Key References

- Schema exports: `src/db/schema/index.ts` (barrel exports all 7 tables)
- Table variables: `users`, `profiles`, `roles`, `permissions`, `rolePermissions`, `userRoles`, `refreshTokens`
- Drizzle type inference: `import { InferSelectModel, InferInsertModel } from "drizzle-orm"`
- Express type augmentation pattern: `declare global { namespace Express { interface Request { ... } } }`
- Module system: CommonJS (`"type": "commonjs"` in package.json), `NodeNext` module resolution

## Verification

1. `npx vitest run` — all type tests pass
2. `npm run build` — TypeScript compiles without errors
