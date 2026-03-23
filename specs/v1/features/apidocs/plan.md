# Plan: Add API Documentation

## Context

The IAM microservice has no interactive API documentation. Developers need to explore and test endpoints without reading source code. This plan adds an OpenAPI 3.1 spec served via Swagger UI at `/docs`.

## Approach

**Hand-authored OpenAPI 3.1 YAML + `swagger-ui-dist`**

Zod 4's `toJSONSchema` throws on `.transform()` calls (used on every email field), so auto-generation from validators is not viable. A hand-authored YAML spec is the simplest, most stable solution. `swagger-ui-dist` provides the Swagger UI static assets with no extra dependencies and integrates cleanly with Express's built-in `express.static()`.

## Files

### New files
| File | Purpose |
|---|---|
| `src/docs/openapi.yaml` | Full OpenAPI 3.1 specification |
| `src/routes/docs.routes.ts` | Express router: `GET /spec`, `GET /` redirect, static assets |
| `src/routes/__tests__/docs.routes.test.ts` | Route tests (written first per git workflow) |

### Modified files
| File | Change |
|---|---|
| `src/app.ts` | Mount `docsRouter` at `/docs` before `errorHandler` |
| `package.json` | Add `swagger-ui-dist` to `dependencies` |

## Implementation Steps

### 1. Branch setup
```bash
git checkout main && git pull
git checkout -b feat/api-docs
```

### 2. Install dependency
```bash
npm install swagger-ui-dist
```

### 3. Write failing tests (commit before implementation)

`src/routes/__tests__/docs.routes.test.ts`:
- Universal env mock (required pattern)
- Mock `swagger-ui-dist` → `{ absolutePath: () => "/fake/path" }`
- Mock `res.sendFile` (avoids touching disk)
- Test: `GET /spec` handler calls `res.sendFile` with path ending in `docs/openapi.yaml`
- Test: router has a static middleware layer (check `router.stack` for a layer with no `.route`)
- Test: `GET /` handler calls `res.redirect` with `/docs/index.html?url=/docs/spec`

Follow `auth.routes.test.ts` pattern for `getHandler` extraction.

Commit: `test: add failing tests for GET /docs docs route`

### 4. Implement `src/routes/docs.routes.ts`

```ts
import { Router } from "express";
import path from "path";
import express from "express";

const { absolutePath } = require("swagger-ui-dist") as { absolutePath: () => string };

const router = Router();

router.get("/spec", (_req, res) => {
  res.type("yaml");
  res.sendFile(path.join(__dirname, "../docs/openapi.yaml"));
});

router.get("/", (_req, res) => {
  res.redirect("/docs/index.html?url=/docs/spec");
});

router.use(express.static(absolutePath()));

export default router;
```

Note: `require()` is correct here — the project is `"type": "commonjs"` and `swagger-ui-dist` has no ESM exports.

Commit: `feat: add docs router serving OpenAPI spec and Swagger UI`

### 5. Mount in `src/app.ts`

Add after existing routers, before `errorHandler`:
```ts
import docsRouter from "./routes/docs.routes.js";
// ...
app.use("/docs", docsRouter);
app.use(errorHandler); // stays last
```

Commit: `feat: mount /docs router in app`

### 6. Author `src/docs/openapi.yaml`

OpenAPI 3.1. Key schema details derived from actual service return types:

**Auth endpoints** (`/auth`):
- `POST /auth/register` → 201 `{ success: true, data: { id: uuid, email, createdAt } }`
- `POST /auth/login` → 200 `{ success: true, data: { accessToken, refreshToken, user: { id, email } } }`
- `POST /auth/refresh` → 200 `{ success: true, data: { accessToken, refreshToken } }`
- `POST /auth/change-password` → 200 `{ success: true }` (requires Bearer token)
- `POST /auth/reset-password` → 200 `{ success: true, data: { resetToken } }`
- `POST /auth/reset-password/confirm` → 200 `{ success: true }`

**Users endpoints** (`/users`, all require Bearer token):
- `POST /users` → 201 `{ success: true, data: { id, email, createdAt } }` (requires `user:write`)
- `GET /users` → 200 `{ success: true, data: { users: [...], pagination: { page, limit, total, totalPages } } }` (requires `user:read`)
- `PATCH /users/:id` → 200 `{ success: true, data: { id, email, isActive, updatedAt } }` (requires `user:write`)
- `PUT /users/:id/roles` → 200 `{ success: true }` (requires `role:write`)

**Request schemas** (derived from Zod validators):
- `isActive` query param: `type: string, enum: ["true", "false"]` (NOT boolean — query strings are always strings; the Zod transform handles conversion internally)
- `roleIds`: `type: array, items: { type: string, format: uuid }, minItems: 1`
- `password`: `type: string, minLength: 8, maxLength: 128`
- `email`: `type: string, format: email`

**Error responses** (uniform shape `{ success: false, error: string }`):
- 400 — validation failure
- 401 — `UnauthorizedError`
- 403 — `ForbiddenError`
- 404 — `NotFoundError`
- 409 — `ConflictError`
- 500 — unhandled error

Commit: `docs: add OpenAPI 3.1 spec for all auth and users endpoints`

### 7. Run tests and fix failures
```bash
npm test
```

### 8. Follow git workflow
- Update `specs/v1/implementation-plan.md` to mark task complete
- Run `/claude-md-management:revise-claude-md`
- Commit, push, create PR to main

## Verification

1. Start dev server: `npm run dev`
2. Open browser at `http://localhost:<PORT>/docs` → redirects to Swagger UI with spec loaded
3. `curl http://localhost:<PORT>/docs/spec` → returns YAML content with `Content-Type: application/yaml`
4. Use Swagger UI to test a public endpoint (e.g. `POST /auth/register`) end-to-end
5. Run `npm test` — all tests pass including new `docs.routes.test.ts`
