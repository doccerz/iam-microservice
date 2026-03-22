import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSqlClient = { end: vi.fn() };
const mockDb = { $client: mockSqlClient };
const mockDrizzle = vi.fn(() => mockDb);

vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mockDrizzle }));

vi.mock("../../config/env.js", () => ({
  env: {
    DATABASE_URL: "postgres://test:test@localhost:5432/testdb",
    DATABASE_SCHEMA: "iam",
  },
}));

// ── db/index.ts tests ──────────────────────────────────────────────

describe("db/index.ts — Drizzle client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports a db instance created by drizzle()", async () => {
    const { db } = await import("../index.js");
    expect(db).toBe(mockDb);
  });

  it("exports the raw sql client from db.$client", async () => {
    const { sql } = await import("../index.js");
    expect(sql).toBe(mockSqlClient);
  });

  it("calls drizzle with DATABASE_URL and schema containing tables + relations", async () => {
    await import("../index.js");

    expect(mockDrizzle).toHaveBeenCalledOnce();

    const [url, config] = mockDrizzle.mock.calls[0];
    expect(url).toBe("postgres://test:test@localhost:5432/testdb");
    expect(config).toHaveProperty("schema");

    const schemaKeys = Object.keys(config.schema);

    // Tables from schema/index.ts
    expect(schemaKeys).toEqual(
      expect.arrayContaining([
        "users",
        "profiles",
        "roles",
        "permissions",
        "rolePermissions",
        "userRoles",
        "refreshTokens",
      ])
    );

    // Relations from relations.ts
    expect(schemaKeys).toEqual(
      expect.arrayContaining([
        "usersRelations",
        "profilesRelations",
        "rolesRelations",
        "permissionsRelations",
        "rolePermissionsRelations",
        "userRolesRelations",
        "refreshTokensRelations",
      ])
    );
  });
});

// ── db/migrate.ts tests ────────────────────────────────────────────

const mockMigrate = vi.fn().mockResolvedValue(undefined);

vi.mock("drizzle-orm/postgres-js/migrator", () => ({ migrate: mockMigrate }));

vi.mock("../index.js", () => ({
  db: mockDb,
  sql: mockSqlClient,
}));

describe("db/migrate.ts — runMigrations()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls migrate with the db instance and correct config", async () => {
    const { runMigrations } = await import("../migrate.js");
    await runMigrations();

    expect(mockMigrate).toHaveBeenCalledOnce();
    expect(mockMigrate).toHaveBeenCalledWith(mockDb, {
      migrationsFolder: "./drizzle",
      migrationsSchema: "iam",
    });
  });

  it("propagates errors from migrate", async () => {
    const error = new Error("migration failed");
    mockMigrate.mockRejectedValueOnce(error);

    const { runMigrations } = await import("../migrate.js");
    await expect(runMigrations()).rejects.toThrow("migration failed");
  });
});
