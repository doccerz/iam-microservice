#!/bin/sh
set -e

echo "Running migrations..."
node dist/db/migrate.js

echo "Seeding database..."
node dist/db/seed.js

echo "Starting server..."
exec node dist/server.js
