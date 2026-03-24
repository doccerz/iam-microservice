# Stage 1: Builder
FROM node:24-alpine AS builder

# Install build tools required for argon2 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/

RUN npm run build && cp -r src/docs dist/docs

RUN npm prune --omit=dev

# Stage 2: Runtime
FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
