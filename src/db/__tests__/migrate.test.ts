import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSqlClient = { end: vi.fn() };
const mockDb = { $client: mockSqlClient };
const mockMigrate = vi.fn().mockResolvedValue(undefined);

vi.mock("drizzle-orm/postgres-js/migrator", () => ({ migrate: mockMigrate }));

vi.mock("../index.js", () => ({
  db: mockDb,
  sql: mockSqlClient,
}));

vi.mock("../../config/env.js", () => ({
  env: {
    DATABASE_URL: "postgres://test:test@localhost:5432/testdb",
    DATABASE_SCHEMA: "iam",
  },
}));

// ── db/migrate.ts tests ────────────────────────────────────────────

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
