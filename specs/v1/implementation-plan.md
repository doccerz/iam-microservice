# IAM Microservice Implementation Plan

## Context

Building a greenfield Identity and Access Management (IAM) microservice from the spec at `specs/20260322/001/IAM microservice plan.md`. The project directory is empty — no code, no config, no dependencies exist yet. The goal is a production-grade TypeScript/Node.js service with PostgreSQL-backed RBAC, JWT auth, and Argon2id password hashing.

---

## Folder Structure

```
src/
├── config/
│   └── env.ts                    # Typed env config (dotenv)
├── db/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── profiles.ts
│   │   ├── roles.ts
│   │   ├── permissions.ts
│   │   ├── role-permissions.ts
│   │   ├── user-roles.ts
│   │   ├── refresh-tokens.ts
│   │   └── index.ts              # Barrel re-export
│   ├── relations.ts              # Drizzle relations
│   ├── index.ts                  # Drizzle client instance
│   ├── migrate.ts                # Migration runner
│   └── seed.ts                   # Seed roles + permissions
├── middleware/
│   ├── authenticate.ts           # JWT validation
│   ├── authorize.ts              # Permission guard
│   ├── validate.ts               # Zod validation middleware
│   └── error-handler.ts          # Global error handler
├── routes/
│   ├── auth.routes.ts
│   └── users.routes.ts
├── services/
│   ├── auth.service.ts
│   └── users.service.ts
├── utils/
│   ├── async-handler.ts          # Express async wrapper
│   ├── errors.ts                 # AppError subclasses
│   ├── jwt.ts                    # Sign/verify tokens
│   ├── password.ts               # Argon2id hash/verify
│   └── response.ts               # Consistent API responses
├── validators/
│   ├── auth.validators.ts
│   └── users.validators.ts
├── types/
│   ├── express.d.ts              # Augment Request with user
│   └── index.ts                  # Shared types (JwtPayload, etc.)
├── app.ts                        # Express app setup
└── server.ts                     # Entry point
drizzle.config.ts
docker-compose.yml
Dockerfile
.dockerignore
.env.example
.gitignore
tsconfig.json
package.json
```

---

## Progress Tracker

> **IMPORTANT**: Checked (`[x]`) tasks and their parent phases are **DONE** and **FROZEN**.
> Do NOT re-scan or re-plan them. When planning or executing work,
> start from the first unchecked (`[ ]`) task. Only reference completed phases for context
> (e.g., imports, schemas) — never as work items.

### Phase 0: Project Initialization
- [x] Initialize project, install dependencies, configure `package.json` scripts
- [x] Configure `tsconfig.json`
- [x] Configure `drizzle.config.ts`
- [x] Create `src/config/env.ts`

### Phase 1: Database Schema, Types, Seed
- [x] Task 1.1: Drizzle Schema (7 tables)
- [x] Task 1.2: TypeScript Types (`src/types/`)
- [x] Task 1.3: DB Client + Migration
- [x] Task 1.4: Seed Script

### Phase 2: Authentication Core
- [x] Task 2.1: Utilities (password, jwt, response, errors, async-handler)
- [x] Task 2.2: Validation Schemas (validate middleware, auth validators)
- [x] Task 2.3: Auth Service (register, login)
- [x] Task 2.4: Auth Routes + App Setup

### Phase 3: Authorization Middleware & Refresh Tokens
- [x] Task 3.1: JWT Validation Middleware
- [x] Task 3.3: Refresh Token Endpoint
- [x] Task 3.2: Permission Guard

### Phase 4: Account Lifecycle & Admin Routes
- [x] Task 4.1: Change Password
- [x] Task 4.2: Reset Password
- [x] Task 4.3: Users Service & Routes

### Phase 5: Containerization
- [ ] Task 5.1: Dockerfile
- [ ] Task 5.2: docker-compose.yml

---

## Phase 0: Project Initialization

### Files to create: `package.json`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `src/config/env.ts`, `.dockerignore`

1. **`npm init -y`** then install dependencies:
   - Runtime: `express`, `drizzle-orm`, `postgres`, `argon2`, `jsonwebtoken`, `zod`, `dotenv`
   - Dev: `typescript`, `@types/express`, `@types/jsonwebtoken`, `@types/node`, `tsx`, `drizzle-kit`

2. **`package.json` scripts:**
   ```
   "dev": "tsx watch src/server.ts"
   "build": "tsc"
   "start": "node dist/server.js"
   "db:generate": "drizzle-kit generate"
   "db:migrate": "tsx src/db/migrate.ts"
   "db:seed": "tsx src/db/seed.ts"
   ```

3. **`tsconfig.json`**: target ES2022, module NodeNext, strict, outDir `./dist`, rootDir `./src`
4. **`drizzle.config.ts`**: schema path `src/db/schema/index.ts`, output `./drizzle`, connection from `DATABASE_URL`
5. **`src/config/env.ts`**: Load dotenv, export typed config:
   - `DATABASE_SCHEMA`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `JWT_ACCESS_EXPIRY` (default "15m"), `JWT_REFRESH_EXPIRY` (default "7d")
   - `PORT` (default 3000), `DEFAULT_ROLE_SLUG` (default "user")

---

## Phase 1: Database Schema, Types, Seed

### Task 1.1: Drizzle Schema (7 tables in `src/db/schema/`)

> Use DATABASE_SCHEMA as its schema
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id (uuid PK), email (unique), password_hash, is_active, created_at, updated_at | |
| `profiles` | id (uuid PK), user_id (FK unique), first_name, last_name, avatar_url | cascade delete |
| `roles` | id (uuid PK), name, slug (unique), created_at | |
| `permissions` | id (uuid PK), slug (unique), description, created_at | |
| `role_permissions` | role_id + permission_id (composite PK) | cascade delete both FKs |
| `user_roles` | user_id + role_id (composite PK) | cascade delete both FKs |
| `refresh_tokens` | id (uuid PK), user_id (FK), token (unique), expires_at | index on user_id |

Barrel export from `src/db/schema/index.ts`. Relations in `src/db/relations.ts`.

### Task 1.2: TypeScript Types (`src/types/`)
- Derive types from Drizzle via `InferSelectModel`/`InferInsertModel`
- Define `JwtPayload { sub, email, permissions: string[] }`
- Define `ApiResponse<T> { success, data?, error? }`
- Augment Express `Request` with `user?: JwtPayload`

### Task 1.3: DB Client + Migration (`src/db/index.ts`, `src/db/migrate.ts`)
- Create Drizzle client with `postgres` driver
- Migration runner using `drizzle-orm/postgres-js/migrator`

### Task 1.4: Seed Script (`src/db/seed.ts`)
- Permissions: `user:read`, `user:write`, `user:delete`, `role:read`, `role:write`
- Roles: `admin` (all permissions), `user` (`user:read` only)
- Use `onConflictDoNothing()` for idempotency

---

## Phase 2: Authentication Core

### Task 2.1: Utilities

- **`src/utils/password.ts`**: `hashPassword()`, `verifyPassword()` using argon2id
- **`src/utils/jwt.ts`**: `signAccessToken()`, `signRefreshToken()`, `verifyAccessToken()`, `verifyRefreshToken()`
- **`src/utils/response.ts`**: `sendSuccess()`, `sendError()`
- **`src/utils/errors.ts`**: `AppError`, `ConflictError(409)`, `UnauthorizedError(401)`, `ForbiddenError(403)`, `NotFoundError(404)`
- **`src/utils/async-handler.ts`**: Wraps async route handlers to forward errors to Express

### Task 2.2: Validation Schemas

- **`src/middleware/validate.ts`**: Generic zod validation middleware factory
- **`src/validators/auth.validators.ts`**: `registerSchema`, `loginSchema`, `changePasswordSchema`, `resetPasswordSchema`

### Task 2.3: Auth Service (`src/services/auth.service.ts`)

- **`register(data)`**: Check email uniqueness -> hash password -> insert user + profile + default role assignment (transaction)
- **`login(email, password)`**: Fetch user -> verify password -> fetch permissions (join user_roles -> role_permissions -> permissions) -> sign access + refresh tokens -> store refresh token in DB

### Task 2.4: Auth Routes + App Setup

- **`src/routes/auth.routes.ts`**: `POST /auth/register`, `POST /auth/login`
- **`src/app.ts`**: Express setup, JSON body parser, mount routers, global error handler
- **`src/server.ts`**: Import app, listen on configured port
- **`src/middleware/error-handler.ts`**: Catch AppError subclasses, map to HTTP status

---

## Phase 3: Authorization Middleware & Refresh Tokens

### Task 3.1: JWT Validation Middleware (`src/middleware/authenticate.ts`)

- Extract Bearer token from Authorization header
- Verify with `verifyAccessToken()`, attach decoded payload to `req.user`
- Return 401 on missing/invalid token

### Task 3.2: Permission Guard (`src/middleware/authorize.ts`)

- Higher-order function: `authorize(...requiredPermissions)` returns middleware
- Checks all required permissions exist in `req.user.permissions`
- Returns 403 if insufficient

### Task 3.3: Refresh Token Endpoint

- Add `POST /auth/refresh` route
- Service: verify refresh token -> look up in DB -> delete old token (rotation) -> re-fetch permissions -> issue new token pair -> store new refresh token
- Extract permission-fetching query into reusable `getUserPermissions(userId)` function

---

## Phase 4: Account Lifecycle & Admin Routes

### Task 4.1: Change Password (`POST /auth/change-password`)

- Authenticated route
- Verify old password -> hash new -> update DB -> **delete ALL refresh tokens for user** (security kill-switch)

### Task 4.2: Reset Password (`POST /auth/reset-password`)

- Generate short-lived reset token (15min JWT with purpose claim)
- `POST /auth/reset-password/confirm`: verify token -> hash new password -> update DB -> revoke refresh tokens

### Task 4.3: Users Service & Routes

- **`src/services/users.service.ts`**:
  - `createUser(data)` — admin creates user with specific roles
  - `listUsers(filters)` — paginated, filterable by isActive, joins profiles
  - `updateUser(id, data)` — PATCH profile fields + isActive flag (transaction)
  - `updateUserRoles(userId, roleIds)` — replace strategy in transaction

- **`src/validators/users.validators.ts`**: Zod schemas for all user endpoints

- **`src/routes/users.routes.ts`**:
  ```
  POST   /users           -> authenticate, authorize('user:write'), validate, handler
  GET    /users           -> authenticate, authorize('user:read'), validate, handler
  PATCH  /users/:id       -> authenticate, authorize('user:write'), validate, handler
  PUT    /users/:id/roles -> authenticate, authorize('role:write'), validate, handler
  ```

---

## Phase 5: Containerization

### Task 5.1: Dockerfile

- Multi-stage: build (Node 20 alpine, tsc) -> run (copy dist + production node_modules + drizzle/)

### Task 5.2: docker-compose.yml

- PostgreSQL 16 alpine with persistent volume
- App service linked to DB, env vars for DATABASE_URL, JWT secrets, PORT

---

## Key Implementation Patterns

1. **Transactions** for multi-table mutations (register, role updates)
2. **Refresh token rotation** — single-use tokens, old deleted on refresh
3. **Password change kill-switch** — revokes all refresh tokens
4. **Permission flattening** — reusable `getUserPermissions(userId)` used by login + refresh
5. **Idempotent seed** — `onConflictDoNothing()` on unique slugs
6. **Async error propagation** — `asyncHandler` wrapper + typed AppError subclasses + global error handler

---

## Verification

1. **Start services**: `docker-compose up -d db` then `npm run db:migrate && npm run db:seed && npm run dev`
2. **Register**: `POST /auth/register` with email/password -> expect 201 with user data
3. **Login**: `POST /auth/login` -> expect access + refresh tokens, decode JWT to verify permissions array
4. **Protected route**: `GET /users` without token -> 401; with user token -> 403; with admin token -> 200
5. **Refresh**: `POST /auth/refresh` with refresh token -> new token pair
6. **Change password**: `POST /auth/change-password` -> verify old refresh tokens are invalidated
7. **Admin CRUD**: Create user, list users, update user, assign roles — verify permission guards work
8. **Docker**: `docker-compose up --build` -> full stack runs, endpoints respond
