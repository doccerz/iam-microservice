import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    DATABASE_URL: "postgres://localhost/test",
    DATABASE_SCHEMA: "public",
    PORT: "3000",
    DEFAULT_ROLE_SLUG: "user",
  },
}));

const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();

const mockTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: mockWhere,
  innerJoin: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: mockValues,
  returning: mockReturning,
};

const mockDb = {
  transaction: vi.fn(),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: mockWhere,
  innerJoin: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: mockValues,
  returning: mockReturning,
};

vi.mock("../../db/index.js", () => ({ db: mockDb }));

vi.mock("../../utils/password.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("access-token"),
  signRefreshToken: vi.fn().mockReturnValue("refresh-token"),
}));

// Import after mocks
import { register, login, getUserPermissions } from "../auth.service.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";

const MOCK_USER = {
  id: "user-uuid",
  email: "test@example.com",
  passwordHash: "hashed-password",
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const MOCK_ROLE = { id: "role-uuid", slug: "user", name: "User", createdAt: new Date() };

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.select.mockReturnThis();
    mockTx.from.mockReturnThis();
    mockTx.innerJoin.mockReturnThis();
    mockTx.insert.mockReturnThis();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.insert.mockReturnThis();
  });

  // --- getUserPermissions ---

  describe("getUserPermissions", () => {
    it("returns flat array of permission slugs for a user", async () => {
      mockWhere.mockResolvedValueOnce([
        { slug: "user:read" },
        { slug: "user:write" },
      ]);

      const result = await getUserPermissions("user-uuid");

      expect(result).toEqual(["user:read", "user:write"]);
    });

    it("returns empty array when user has no permissions", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await getUserPermissions("user-uuid");

      expect(result).toEqual([]);
    });
  });

  // --- register ---

  describe("register", () => {
    beforeEach(() => {
      mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx),
      );
    });

    it("returns user data on successful registration", async () => {
      // No existing user
      mockWhere.mockResolvedValueOnce([]);
      // insert user returning
      mockReturning.mockResolvedValueOnce([MOCK_USER]);
      // insert profile values (no returning)
      mockValues.mockResolvedValueOnce([]);
      // find default role
      mockWhere.mockResolvedValueOnce([MOCK_ROLE]);
      // insert user_roles values (no returning)
      mockValues.mockResolvedValueOnce([]);

      const result = await register({
        email: "test@example.com",
        password: "password123",
        firstName: "Test",
        lastName: "User",
      });

      expect(result).toMatchObject({ id: "user-uuid", email: "test@example.com" });
      expect(result).toHaveProperty("createdAt");
    });

    it("throws ConflictError when email already exists", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);

      await expect(
        register({ email: "test@example.com", password: "password123" }),
      ).rejects.toThrow(ConflictError);
    });

    it("calls hashPassword before inserting user", async () => {
      mockWhere.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([MOCK_USER]);
      mockValues.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([MOCK_ROLE]);
      mockValues.mockResolvedValueOnce([]);

      await register({ email: "test@example.com", password: "password123" });

      expect(hashPassword).toHaveBeenCalledWith("password123");
    });

    it("still inserts user when default role is not found", async () => {
      mockWhere.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([MOCK_USER]);
      mockValues.mockResolvedValueOnce([]);
      // No role found
      mockWhere.mockResolvedValueOnce([]);

      const result = await register({ email: "test@example.com", password: "password123" });

      expect(result).toMatchObject({ id: "user-uuid", email: "test@example.com" });
    });
  });

  // --- login ---

  describe("login", () => {
    beforeEach(() => {
      // getUserPermissions uses mockDb (not tx)
      // We need to sequence: find user -> permissions -> insert refresh token
    });

    it("returns accessToken, refreshToken, and user on success", async () => {
      // find user
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      // getUserPermissions (innerJoin chain ends in where)
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]);
      // insert refresh token
      mockValues.mockResolvedValueOnce([]);

      const result = await login({ email: "test@example.com", password: "password123" });

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "user-uuid", email: "test@example.com" },
      });
    });

    it("throws UnauthorizedError when user not found", async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(
        login({ email: "unknown@example.com", password: "password123" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when user is inactive", async () => {
      mockWhere.mockResolvedValueOnce([{ ...MOCK_USER, isActive: false }]);

      await expect(
        login({ email: "test@example.com", password: "password123" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when password is wrong", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      vi.mocked(verifyPassword).mockResolvedValueOnce(false);

      await expect(
        login({ email: "test@example.com", password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("stores refresh token in DB on success", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]);
      mockValues.mockResolvedValueOnce([]);

      await login({ email: "test@example.com", password: "password123" });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-uuid",
          token: "refresh-token",
          expiresAt: expect.any(Date),
        }),
      );
    });
  });
});
