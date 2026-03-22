import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    DATABASE_URL: "postgres://localhost/test",
    DATABASE_SCHEMA: "iam",
    PORT: "3000",
    DEFAULT_ROLE_SLUG: "user",
  },
}));

const { mockDb, mockWhere, mockReturning, mockTx, mockOffset } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();
  const mockOffset = vi.fn();

  const mockTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: mockWhere,
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockReturning,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  const mockDb = {
    transaction: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: mockWhere,
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockReturning,
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: mockOffset,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return { mockDb, mockWhere, mockReturning, mockTx, mockOffset };
});

vi.mock("../../db/index.js", () => ({ db: mockDb }));

vi.mock("../../utils/password.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  verifyPassword: vi.fn(),
}));

import { createUser, listUsers, updateUser, updateUserRoles } from "../users.service.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";
import { hashPassword } from "../../utils/password.js";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const roleUuid = "660e8400-e29b-41d4-a716-446655440000";

describe("users.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.leftJoin.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
    mockTx.select.mockReturnThis();
    mockTx.from.mockReturnThis();
    mockTx.insert.mockReturnThis();
    mockTx.values.mockReturnThis();
    mockTx.update.mockReturnThis();
    mockTx.set.mockReturnThis();
    mockTx.delete.mockReturnThis();
    vi.mocked(hashPassword).mockResolvedValue("hashed-password");
  });

  describe("createUser", () => {
    it("creates user, profile, and roles in a transaction", async () => {
      const newUser = { id: validUuid, email: "new@example.com", createdAt: new Date() };
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([]); // no existing user
        mockTx.returning.mockResolvedValueOnce([newUser]); // insert user
        mockTx.returning.mockResolvedValue([]); // profile insert
        return fn(mockTx);
      });

      const result = await createUser({
        email: "new@example.com",
        password: "password123",
        roleIds: [roleUuid],
      });

      expect(result).toMatchObject({ id: validUuid, email: "new@example.com" });
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it("throws ConflictError when email already exists", async () => {
      const existingUser = { id: validUuid, email: "existing@example.com" };
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([existingUser]);
        return fn(mockTx);
      });

      await expect(
        createUser({ email: "existing@example.com", password: "password123", roleIds: [roleUuid] }),
      ).rejects.toThrow(ConflictError);
    });

    it("calls hashPassword before inserting", async () => {
      const newUser = { id: validUuid, email: "new@example.com", createdAt: new Date() };
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([]);
        mockTx.returning.mockResolvedValueOnce([newUser]);
        mockTx.returning.mockResolvedValue([]);
        return fn(mockTx);
      });

      await createUser({ email: "new@example.com", password: "password123", roleIds: [roleUuid] });

      expect(hashPassword).toHaveBeenCalledWith("password123");
    });

    it("assigns all provided roleIds", async () => {
      const newUser = { id: validUuid, email: "new@example.com", createdAt: new Date() };
      const roleUuid2 = "770e8400-e29b-41d4-a716-446655440000";
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([]);
        mockTx.returning.mockResolvedValueOnce([newUser]);
        mockTx.returning.mockResolvedValue([]);
        return fn(mockTx);
      });

      await createUser({
        email: "new@example.com",
        password: "password123",
        roleIds: [roleUuid, roleUuid2],
      });

      expect(mockTx.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: validUuid, roleId: roleUuid }),
          expect.objectContaining({ userId: validUuid, roleId: roleUuid2 }),
        ]),
      );
    });
  });

  describe("listUsers", () => {
    const userRows = [
      {
        id: validUuid,
        email: "user@example.com",
        isActive: true,
        createdAt: new Date(),
        firstName: "Alice",
        lastName: "Smith",
        avatarUrl: null,
      },
    ];

    it("returns users array and pagination metadata", async () => {
      mockWhere
        .mockResolvedValueOnce([{ total: 1 }])
        .mockReturnValue(mockDb);
      mockOffset.mockResolvedValueOnce(userRows);

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns empty users array and total=0 when no results", async () => {
      mockWhere
        .mockResolvedValueOnce([{ total: 0 }])
        .mockReturnValue(mockDb);
      mockOffset.mockResolvedValueOnce([]);

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it("applies correct offset based on page number", async () => {
      mockWhere
        .mockResolvedValueOnce([{ total: 40 }])
        .mockReturnValue(mockDb);
      mockOffset.mockResolvedValueOnce(userRows);

      await listUsers({ page: 3, limit: 10 });

      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });

    it("calculates totalPages correctly", async () => {
      mockWhere
        .mockResolvedValueOnce([{ total: 25 }])
        .mockReturnValue(mockDb);
      mockOffset.mockResolvedValueOnce([]);

      const result = await listUsers({ page: 1, limit: 10 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it("filters by isActive when provided", async () => {
      mockWhere
        .mockResolvedValueOnce([{ total: 1 }])
        .mockReturnValue(mockDb);
      mockOffset.mockResolvedValueOnce(userRows);

      await listUsers({ page: 1, limit: 20, isActive: true });

      // where should be called twice (count + data query)
      expect(mockWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateUser", () => {
    const existingUser = {
      id: validUuid,
      email: "user@example.com",
      isActive: true,
      updatedAt: new Date(),
    };

    it("throws NotFoundError when user not found", async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([]);
        return fn(mockTx);
      });

      await expect(updateUser(validUuid, { isActive: false })).rejects.toThrow(NotFoundError);
    });

    it("updates isActive on users table when provided", async () => {
      const updatedUser = { ...existingUser, isActive: false };
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([existingUser]); // fetch user
        mockTx.returning.mockResolvedValueOnce([updatedUser]); // update user returning
        return fn(mockTx);
      });

      const result = await updateUser(validUuid, { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it("updates profile fields when provided", async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([existingUser]); // fetch user
        mockTx.returning.mockResolvedValueOnce([existingUser]); // update returning (isActive not changed)
        mockTx.where.mockResolvedValue([]); // profile update
        return fn(mockTx);
      });

      await updateUser(validUuid, { firstName: "Alice" });

      expect(mockTx.update).toHaveBeenCalled();
    });

    it("returns updated user data", async () => {
      const updatedUser = { ...existingUser, isActive: false, updatedAt: new Date() };
      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValueOnce([existingUser]);
        mockTx.returning.mockResolvedValueOnce([updatedUser]);
        return fn(mockTx);
      });

      const result = await updateUser(validUuid, { isActive: false });

      expect(result).toMatchObject({ id: validUuid, email: "user@example.com" });
    });
  });

  describe("updateUserRoles", () => {
    it("throws NotFoundError when user not found", async () => {
      mockWhere.mockResolvedValueOnce([]); // user not found

      await expect(updateUserRoles(validUuid, { roleIds: [roleUuid] })).rejects.toThrow(NotFoundError);
    });

    it("deletes existing roles and inserts new ones in transaction", async () => {
      const existingUser = { id: validUuid, email: "user@example.com" };
      mockWhere.mockResolvedValueOnce([existingUser]); // user exists check

      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValue([]); // delete
        mockTx.returning.mockResolvedValue([]); // insert
        return fn(mockTx);
      });

      await updateUserRoles(validUuid, { roleIds: [roleUuid] });

      expect(mockTx.delete).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it("handles multiple roleIds correctly", async () => {
      const existingUser = { id: validUuid, email: "user@example.com" };
      const roleUuid2 = "770e8400-e29b-41d4-a716-446655440000";
      mockWhere.mockResolvedValueOnce([existingUser]);

      mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        mockTx.where.mockResolvedValue([]);
        mockTx.returning.mockResolvedValue([]);
        return fn(mockTx);
      });

      await updateUserRoles(validUuid, { roleIds: [roleUuid, roleUuid2] });

      expect(mockTx.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: validUuid, roleId: roleUuid }),
          expect.objectContaining({ userId: validUuid, roleId: roleUuid2 }),
        ]),
      );
    });
  });
});
