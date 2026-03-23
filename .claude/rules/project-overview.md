# Project Overview

Identity and Access Management (IAM) microservice with authentication and RBAC-based user management.

## Tech Stack

- **Runtime:** TypeScript on Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL with Drizzle-ORM
- **Auth:** JWT (access + refresh tokens) with Argon2id password hashing
- **Validation:** Zod
- **API Style:** REST

## Architecture

Layered architecture: routes -> middleware -> services -> db

```
src/
├── config/env.ts          # Typed env config (dotenv)
├── db/schema/             # Drizzle table definitions (7 RBAC tables)
├── db/relations.ts        # Drizzle relations
├── db/index.ts            # DB client
├── db/migrate.ts          # Migration runner
├── db/seed.ts             # Seed roles + permissions
├── middleware/             # authenticate, authorize, validate, error-handler
├── routes/                # auth.routes.ts, users.routes.ts
├── services/              # auth.service.ts, users.service.ts
├── utils/                 # password, jwt, errors, response, async-handler
├── validators/            # Zod schemas for auth + users
├── types/                 # Shared types, Express augmentation
├── app.ts                 # Express app setup
└── server.ts              # Entry point
```

## Database Schema (RBAC)

7 tables: `users`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `refresh_tokens`

- Permission-based access control (not role-based checks)
- JWT contains flattened array of permission slugs
- Refresh token rotation (single-use)
- Password change revokes all refresh tokens (kill-switch)

## Key Commands

```bash
npm run dev              # Start dev server (tsx watch)
npm run build            # Compile TypeScript
npm run start            # Run compiled JS
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations
npm run db:seed          # Seed roles + permissions
```

## API Endpoints

### Auth (`/auth`)
- `POST /auth/register` — Public registration (assigns default role)
- `POST /auth/login` — Returns access + refresh tokens
- `POST /auth/refresh` — Rotate refresh token, issue new pair
- `POST /auth/change-password` — Requires old password, revokes all sessions
- `POST /auth/reset-password` — Token-based reset

### Users (`/users`)
- `POST /users` — Admin-only user creation with role assignment
- `GET /users` — List/filter users (admin only, paginated)
- `PATCH /users/:id` — Update profile or deactivate
- `PUT /users/:id/roles` — Reassign roles

## Docker Notes
- `argon2` is a native addon — builder stage needs `apk add --no-cache python3 make g++` (Alpine) to compile it
- `npm run db:migrate` uses `tsx` (dev dep), so run migrations from host or add a compiled migrate entrypoint for containers
- `docker-compose.yml`: db service named `db`; DATABASE_URL uses `@db:5432`; startup order: `docker-compose up -d db` → `npm run db:migrate && npm run db:seed` → `docker-compose up app`
- `jq` is not installed — use raw `curl` output for API testing (no `| jq`)
- psql shorthand: `docker compose exec db psql -U user -d iam_db` — schema tables need quoting: `"user-service".<table>`
