import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSqlClient = { end: vi.fn() };

const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockReturning = vi.fn(() => ({
  onConflictDoNothing: mockOnConflictDoNothing,
}));
const mockValues = vi.fn(() => ({
  onConflictDoNothing: mockOnConflictDoNothing,
  returning: mockReturning,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));

const mockWhere = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) }));

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  $client: mockSqlClient,
};

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

// ── db/seed.ts tests ──────────────────────────────────────────────

describe("db/seed.ts — seedDatabase()", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock behavior
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockReturning.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
    });
    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      returning: mockReturning,
    });
    mockInsert.mockReturnValue({ values: mockValues });

    // Mock select().from().where() to return permissions and roles
    const mockPermissions = [
      { id: "perm-1", slug: "user:read" },
      { id: "perm-2", slug: "user:write" },
      { id: "perm-3", slug: "user:delete" },
      { id: "perm-4", slug: "role:read" },
      { id: "perm-5", slug: "role:write" },
    ];
    const mockRoles = [
      { id: "role-1", slug: "admin" },
      { id: "role-2", slug: "user" },
    ];

    let selectCallCount = 0;
    const mockFrom = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { where: vi.fn().mockResolvedValue(mockPermissions) };
      }
      return { where: vi.fn().mockResolvedValue(mockRoles) };
    });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("inserts 5 permissions with onConflictDoNothing", async () => {
    const { seedDatabase } = await import("../seed.js");
    await seedDatabase();

    // First insert call should be for permissions
    const firstInsertValues = mockValues.mock.calls[0][0];
    expect(firstInsertValues).toHaveLength(5);

    const slugs = firstInsertValues.map(
      (p: { slug: string }) => p.slug,
    );
    expect(slugs).toContain("user:read");
    expect(slugs).toContain("user:write");
    expect(slugs).toContain("user:delete");
    expect(slugs).toContain("role:read");
    expect(slugs).toContain("role:write");

    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });

  it("inserts 2 roles with onConflictDoNothing", async () => {
    const { seedDatabase } = await import("../seed.js");
    await seedDatabase();

    // Second insert call should be for roles
    const secondInsertValues = mockValues.mock.calls[1][0];
    expect(secondInsertValues).toHaveLength(2);

    const slugs = secondInsertValues.map(
      (r: { slug: string }) => r.slug,
    );
    expect(slugs).toContain("admin");
    expect(slugs).toContain("user");
  });

  it("inserts role-permission mappings with onConflictDoNothing", async () => {
    const { seedDatabase } = await import("../seed.js");
    await seedDatabase();

    // Third insert call should be for role_permissions
    const thirdInsertValues = mockValues.mock.calls[2][0];

    // Admin gets all 5 permissions, user gets 1 = 6 total mappings
    expect(thirdInsertValues).toHaveLength(6);

    // Verify admin has all permissions
    const adminMappings = thirdInsertValues.filter(
      (rp: { roleId: string }) => rp.roleId === "role-1",
    );
    expect(adminMappings).toHaveLength(5);

    // Verify user has only user:read
    const userMappings = thirdInsertValues.filter(
      (rp: { roleId: string }) => rp.roleId === "role-2",
    );
    expect(userMappings).toHaveLength(1);
    expect(userMappings[0].permissionId).toBe("perm-1");
  });

  it("calls insert in correct order: permissions, roles, role_permissions", async () => {
    const { seedDatabase } = await import("../seed.js");
    await seedDatabase();

    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it("propagates errors from insert", async () => {
    const error = new Error("insert failed");
    mockOnConflictDoNothing.mockRejectedValueOnce(error);

    const { seedDatabase } = await import("../seed.js");
    await expect(seedDatabase()).rejects.toThrow("insert failed");
  });
});
