# Task 2.4: Auth Routes + App Setup

## Context

Tasks 2.1–2.3 are complete: utilities, validation schemas, and the auth service (register/login) all exist and are tested. Task 2.4 wires everything together into a runnable Express application by adding the auth routes, app setup, server entry point, and global error handler. No new packages are required.

## Files to Create

| File | Purpose |
|------|---------|
| `src/middleware/error-handler.ts` | Global Express error handler mapping AppError → HTTP status |
| `src/routes/auth.routes.ts` | POST /auth/register, POST /auth/login |
| `src/app.ts` | Express app factory: JSON body parser, mount /auth router, attach error handler |
| `src/server.ts` | Entry point: import app, call `app.listen(env.PORT)` |
| `src/middleware/__tests__/error-handler.test.ts` | Unit tests for error handler |
| `src/routes/__tests__/auth.routes.test.ts` | Unit tests for auth route handlers |

## Implementation Details

### `src/middleware/error-handler.ts`
```ts
// Signature: (err, req, res, next) => void
// If err instanceof AppError → res.status(err.statusCode).json({ success: false, error: err.message })
// Otherwise → res.status(500).json({ success: false, error: 'Internal server error' })
```

### `src/routes/auth.routes.ts`
```ts
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/async-handler.js'
import { register, login } from '../services/auth.service.js'
import { registerSchema, loginSchema } from '../validators/auth.validators.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const user = await register(req.body)
  sendSuccess(res, user, 201)
}))

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const result = await login(req.body)
  sendSuccess(res, result, 200)
}))

export default router
```

### `src/app.ts`
```ts
import express from 'express'
import authRouter from './routes/auth.routes.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()
app.use(express.json())
app.use('/auth', authRouter)
app.use(errorHandler)

export default app
```

### `src/server.ts`
```ts
import app from './app.js'
import { env } from './config/env.js'

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`)
})
```

## Test Strategy (Vitest, no new packages)

Tests follow the existing pattern: mock dependencies with `vi.mock()`, use manual mock req/res/next objects.

### `error-handler.test.ts`
- AppError subclasses (ConflictError 409, UnauthorizedError 401, ForbiddenError 403, NotFoundError 404) → correct statusCode + `{ success: false, error: message }`
- Unknown Error → 500 + `{ success: false, error: 'Internal server error' }`

### `auth.routes.test.ts`
Mock `../../services/auth.service.js` (register, login).
- `POST /register` success → calls register(req.body), sendSuccess(res, user, 201)
- `POST /register` service throws ConflictError → error passed to next()
- `POST /login` success → calls login(req.body), sendSuccess(res, result, 200)
- `POST /login` service throws UnauthorizedError → error passed to next()

(Route handler tests test the handler logic directly with mock req/res, not the full middleware chain — validate middleware is already tested in task 2.2.)

> **Note:** `asyncHandler` returns `void` (no return statement), so `await handler(req, res, next)` only flushes one microtask tick. For rejection paths, an extra `await Promise.resolve()` is needed after the handler call to allow `.catch(next)` to run.

## Workflow

1. Create branch `feat/task-2.4-auth-routes-app-setup` from main
2. Write failing tests (`error-handler.test.ts`, `auth.routes.test.ts`) → commit
3. Implement `error-handler.ts`, `auth.routes.ts`, `app.ts`, `server.ts` → commit
4. Run `npm test` and fix any failures → commit
5. Push branch + open PR to main

## Reused Utilities

- `AppError` and subclasses: `src/utils/errors.ts`
- `asyncHandler`: `src/utils/async-handler.ts`
- `sendSuccess`: `src/utils/response.ts`
- `validate` middleware: `src/middleware/validate.ts`
- `register`, `login`: `src/services/auth.service.ts`
- `registerSchema`, `loginSchema`: `src/validators/auth.validators.ts`
- `env`: `src/config/env.ts`

## Verification

```bash
npm test                      # all tests green (122 passed)
npm run dev                   # server starts on configured port
curl -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}' # 201
curl -X POST localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}' # 200 with tokens
curl -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}' # 409 ConflictError
```

## PR

https://github.com/doccerz/user-microservice-js/pull/9
