# Task 5.2: docker-compose.yml

## Context
Task 5.1 (Dockerfile) is complete. Task 5.2 adds the `docker-compose.yml` to wire up the app container with a PostgreSQL 16 Alpine database, completing the containerization phase.

## What to create

**New file:** `docker-compose.yml` (root)

## Service design

### `db` service
- Image: `postgres:16-alpine`
- Named volume: `postgres_data` → `/var/lib/postgresql/data`
- Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Health check: `pg_isready -U <user> -d <db>` (interval 5s, retries 5) so app waits

### `app` service
- Build: `.` (uses existing Dockerfile)
- Depends on: `db` (condition: `service_healthy`)
- Port mapping: `3000:3000`
- Environment variables (all from .env.example, adapted for compose):
  - `DATABASE_URL=postgresql://user:password@db:5432/iam_db` (host = `db` service name, not `localhost`)
  - `DATABASE_SCHEMA=user-service`
  - `JWT_ACCESS_SECRET=change-me-access`
  - `JWT_REFRESH_SECRET=change-me-refresh`
  - `JWT_ACCESS_EXPIRY=15m`
  - `JWT_REFRESH_EXPIRY=7d`
  - `PORT=3000`
  - `DEFAULT_ROLE_SLUG=user`

### Networks
Single default bridge network (implicit, no explicit declaration needed).

### Volumes
```yaml
volumes:
  postgres_data:
```

## Migration note
`npm run db:migrate` uses `tsx` (dev dep not installed in prod image). Migrations must be run from the host:
```bash
docker-compose up -d db
npm run db:migrate && npm run db:seed
docker-compose up app
```

## No tests
`docker-compose.yml` is pure infrastructure config — no unit tests to write.

## Git workflow (per project rules)
Since there are no failing tests to commit first, the workflow is:
1. Create branch `feat/task-5.2-docker-compose` from `main`
2. Write `docker-compose.yml`
3. Commit
4. Run `/claude-md-management:revise-claude-md`
5. Mark task 5.2 `[x]` in `specs/v1/implementation-plan.md`, commit
6. Push + open PR to `main`

## Verification
```bash
# Build and start db only
docker-compose up -d db

# Run migrations from host (uses tsx dev dep)
npm run db:migrate && npm run db:seed

# Start full stack
docker-compose up --build

# Smoke test
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expect 201
```
