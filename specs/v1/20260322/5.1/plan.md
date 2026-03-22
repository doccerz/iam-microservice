# Task 5.1: Dockerfile

## Context

The IAM microservice is fully implemented (Phases 0–4 complete). Task 5.1 containerizes the app with a production-grade multi-stage Dockerfile as specified in the implementation plan: "build (Node 20 alpine, tsc) -> run (copy dist + production node_modules + drizzle/)".

## Key Facts

- `package.json` `"type": "commonjs"`, build via `tsc`, start via `node dist/server.js`
- Port: 3000 (from `.env.example`)
- `argon2` is a native addon — requires build tools (python3, make, g++) during install
- `.dockerignore` already exists (excludes `node_modules/`, `dist/`, `.env`, `.git/`)
- `drizzle/` folder holds migration SQL files needed if migrations run inside the container
- No Dockerfile exists yet

## Plan

### File to create: `Dockerfile`

**Multi-stage build:**

**Stage 1 — `builder`** (`node:20-alpine`):
- Install OS build tools: `apk add --no-cache python3 make g++` (required for argon2 native compilation)
- `WORKDIR /app`
- Copy `package.json` + `package-lock.json`
- `npm ci` — installs all deps (dev + prod), compiles native modules
- Copy `src/` and `tsconfig.json`
- `RUN npm run build` — compiles TypeScript to `dist/`
- `RUN npm prune --omit=dev` — strips devDependencies from node_modules in-place

**Stage 2 — runtime** (`node:20-alpine`):
- `WORKDIR /app`
- Copy from builder: `node_modules/`, `dist/`, `package.json`
- Copy `drizzle/` from builder (migration files, if present)
- `EXPOSE 3000`
- `CMD ["node", "dist/server.js"]`

### File to update: `.dockerignore`

Add `drizzle/` exclusion is NOT needed (drizzle/ should be sent to build context). Current `.dockerignore` is sufficient — no changes needed.

## Git Workflow

Per project rules:
1. Checkout main + pull
2. Create branch `feat/task-5.1-dockerfile`
3. Write failing tests first → commit
4. Implement Dockerfile → commit
5. Run tests → commit fixes
6. Update CLAUDE.md, mark task `[x]` in implementation-plan.md → commit
7. Push + create PR to main

## Note on Tests

A Dockerfile doesn't have unit tests in the traditional sense. The "test" for this task is:
- `docker build -t iam-microservice .` succeeds with no errors
- The built image contains `dist/server.js`, `node_modules/`, and `drizzle/`
- The image starts and listens on port 3000

Since we cannot run Docker in this environment, the verification step will be a manual `docker build` after implementation.

## Verification

```bash
docker build -t iam-microservice .
docker run --rm -e DATABASE_URL=... -e JWT_ACCESS_SECRET=... -p 3000:3000 iam-microservice
```

Expected: container starts, logs show Express listening on port 3000.

## Critical Files

- `Dockerfile` — create (root of repo)
- `.dockerignore` — already exists, no changes needed
- `specs/v1/implementation-plan.md` — mark Task 5.1 `[x]`
