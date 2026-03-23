# IAM Microservice

Identity and Access Management (IAM) microservice with JWT-based authentication and RBAC-based user management.

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Express.js 5
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Auth:** JWT (access + refresh tokens), Argon2id password hashing
- **Validation:** Zod

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)
- npm

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/iam_db
DATABASE_SCHEMA=public
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=3000
DEFAULT_ROLE_SLUG=user
```

### 3. Run database migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the dev server

```bash
npm run dev
```

The server will be available at `http://localhost:3000`.

## Docker

### Pull from Docker Hub

```bash
docker pull doccerz/user-microservice-js:latest
```

### Run with Docker Compose using the registry image (recommended)

Copy the example compose file and fill in your environment variables:

```bash
cp docker-compose.yml.example docker-compose.yml
# edit docker-compose.yml or create a .env file with the required variables
docker-compose up
```

The app container runs migrations and seeds the database automatically before starting the server (via `entrypoint.sh`). No host-side Node.js required.

### Run with Docker Compose (build locally)

```bash
docker-compose up
```

### Build the image manually

```bash
docker build -t doccerz/user-microservice-js:latest .
```

### Environment variables (Docker Compose)

The `docker-compose.yml` sets sensible defaults for local use. For production, override the secrets:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:password@db:5432/iam_db` | Postgres connection string |
| `DATABASE_SCHEMA` | `user-service` | Drizzle schema name |
| `JWT_ACCESS_SECRET` | `change-me-access` | **Change in production** |
| `JWT_REFRESH_SECRET` | `change-me-refresh` | **Change in production** |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token TTL |
| `PORT` | `3000` | HTTP port |
| `DEFAULT_ROLE_SLUG` | `user` | Role assigned on public registration |

## Scripts

```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
npm run test         # Run tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed roles and permissions
```

## API Reference

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user (assigned default role) |
| `POST` | `/auth/login` | Public | Login, returns access + refresh tokens |
| `POST` | `/auth/refresh` | Public | Rotate refresh token, issue new pair |
| `POST` | `/auth/change-password` | Bearer | Change password, revokes all sessions |
| `POST` | `/auth/reset-password` | Token | Token-based password reset |

### Users — `/users`

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/users` | `user:write` | Create user with role assignment |
| `GET` | `/users` | `user:read` | List / filter users (paginated) |
| `PATCH` | `/users/:id` | `user:write` | Update profile or deactivate |
| `PUT` | `/users/:id/roles` | `role:write` | Reassign roles |

### Response format

All endpoints return a consistent envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "message" }
```

## Architecture

```
src/
├── config/env.ts          # Typed env config
├── db/schema/             # Drizzle table definitions (7 RBAC tables)
├── db/relations.ts        # Drizzle relations
├── db/index.ts            # DB client
├── db/migrate.ts          # Migration runner
├── db/seed.ts             # Seed roles + permissions
├── middleware/            # authenticate, authorize, validate, error-handler
├── routes/                # auth.routes.ts, users.routes.ts
├── services/              # auth.service.ts, users.service.ts
├── utils/                 # password, jwt, errors, response, async-handler
├── validators/            # Zod schemas
├── types/                 # Shared types, Express augmentation
├── app.ts                 # Express app setup
└── server.ts              # Entry point
```
