import { describe, it, expect, vi } from "vitest";

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
  it("calls drizzle with DATABASE_URL and schema containing tables + relations", async () => {
    await import("../index.js");

    expect(mockDrizzle).toHaveBeenCalledOnce();

    const [url, config] = mockDrizzle.mock.calls[0] as unknown as [string, { schema: Record<string, unknown> }];
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

  it("exports a db instance created by drizzle()", async () => {
    const { db } = await import("../index.js");
    expect(db).toBe(mockDb);
  });

  it("exports the raw sql client from db.$client", async () => {
    const { sql } = await import("../index.js");
    expect(sql).toBe(mockSqlClient);
  });
});
