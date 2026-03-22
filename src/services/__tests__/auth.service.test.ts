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

const { mockDb, mockWhere, mockReturning, mockTx, mockVerifyRefreshToken, mockVerifyResetToken } =
  vi.hoisted(() => {
    const mockWhere = vi.fn();
    const mockReturning = vi.fn();

    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: mockWhere,
      innerJoin: vi.fn().mockReturnThis(),
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
      innerJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: mockReturning,
      delete: vi.fn().mockReturnThis(),
    };

    const mockVerifyRefreshToken = vi.fn();
    const mockVerifyResetToken = vi.fn();

    return { mockDb, mockWhere, mockReturning, mockTx, mockVerifyRefreshToken, mockVerifyResetToken };
  });

vi.mock("../../db/index.js", () => ({ db: mockDb }));

vi.mock("../../utils/password.js", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../../utils/jwt.js", () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  signResetToken: vi.fn(),
  verifyRefreshToken: mockVerifyRefreshToken,
  verifyResetToken: mockVerifyResetToken,
}));

import {
  register,
  login,
  refresh,
  getUserPermissions,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "../auth.service.js";
import { ConflictError, UnauthorizedError, NotFoundError } from "../../utils/errors.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, signResetToken } from "../../utils/jwt.js";

const MOCK_USER = {
  id: "user-uuid",
  email: "test@example.com",
  passwordHash: "hashed-password",
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const MOCK_ROLE = { id: "role-uuid", slug: "user", name: "User", createdAt: new Date() };

const MOCK_STORED_TOKEN = {
  id: "token-uuid",
  userId: "user-uuid",
  token: "old-refresh-token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date(),
};

describe("auth.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Restore chain methods after resetAllMocks
    mockTx.select.mockReturnThis();
    mockTx.from.mockReturnThis();
    mockTx.innerJoin.mockReturnThis();
    mockTx.insert.mockReturnThis();
    mockTx.values.mockReturnThis();

    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.delete.mockReturnThis();

    mockTx.update.mockReturnThis();
    mockTx.set.mockReturnThis();
    mockTx.delete.mockReturnThis();

    // Default utility implementations
    vi.mocked(hashPassword).mockResolvedValue("hashed-password");
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(signAccessToken).mockReturnValue("access-token");
    vi.mocked(signRefreshToken).mockReturnValue("new-refresh-token");
    vi.mocked(signResetToken).mockReturnValue("reset-token");
    mockVerifyRefreshToken.mockReturnValue({ sub: "user-uuid" });
    mockVerifyResetToken.mockReturnValue({ sub: "user-uuid" });
  });

  // --- getUserPermissions ---

  describe("getUserPermissions", () => {
    it("returns flat array of permission slugs for a user", async () => {
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }, { slug: "user:write" }]);

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
      mockDb.transaction.mockImplementation(
        async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
      );
    });

    it("returns user data on successful registration", async () => {
      mockWhere.mockResolvedValueOnce([]); // no existing user
      mockReturning.mockResolvedValueOnce([MOCK_USER]); // insert user returning
      mockWhere.mockResolvedValueOnce([MOCK_ROLE]); // find default role

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
      mockWhere.mockResolvedValueOnce([MOCK_ROLE]);

      await register({ email: "test@example.com", password: "password123" });

      expect(hashPassword).toHaveBeenCalledWith("password123");
    });

    it("still inserts user when default role is not found", async () => {
      mockWhere.mockResolvedValueOnce([]); // no existing user
      mockReturning.mockResolvedValueOnce([MOCK_USER]); // insert user
      mockWhere.mockResolvedValueOnce([]); // no role found

      const result = await register({ email: "test@example.com", password: "password123" });

      expect(result).toMatchObject({ id: "user-uuid", email: "test@example.com" });
    });
  });

  // --- login ---

  describe("login", () => {
    it("returns accessToken, refreshToken, and user on success", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]); // find user
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]); // getUserPermissions

      const result = await login({ email: "test@example.com", password: "password123" });

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "new-refresh-token",
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

      await login({ email: "test@example.com", password: "password123" });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-uuid",
          token: "new-refresh-token",
          expiresAt: expect.any(Date),
        }),
      );
    });

    it("signs access token with user id, email, and permissions", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]);

      await login({ email: "test@example.com", password: "password123" });

      expect(signAccessToken).toHaveBeenCalledWith({
        sub: "user-uuid",
        email: "test@example.com",
        permissions: ["user:read"],
      });
    });

    it("signs refresh token with user id only", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      mockWhere.mockResolvedValueOnce([]);

      await login({ email: "test@example.com", password: "password123" });

      expect(signRefreshToken).toHaveBeenCalledWith({ sub: "user-uuid" });
    });
  });

  // --- refresh ---

  describe("refresh", () => {
    it("returns new accessToken and refreshToken on success", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_STORED_TOKEN]); // look up token in DB
      mockWhere.mockResolvedValueOnce([]); // delete where (resolves undefined)
      mockWhere.mockResolvedValueOnce([MOCK_USER]); // find user
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]); // getUserPermissions

      const result = await refresh("old-refresh-token");

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "new-refresh-token",
      });
    });

    it("throws UnauthorizedError when verifyRefreshToken fails", async () => {
      mockVerifyRefreshToken.mockImplementationOnce(() => {
        throw new UnauthorizedError("Invalid or expired refresh token");
      });

      await expect(refresh("bad-token")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when token not found in DB", async () => {
      mockWhere.mockResolvedValueOnce([]); // token not in DB

      await expect(refresh("old-refresh-token")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when token is expired", async () => {
      mockWhere.mockResolvedValueOnce([
        { ...MOCK_STORED_TOKEN, expiresAt: new Date(Date.now() - 1000) }, // expired
      ]);

      await expect(refresh("old-refresh-token")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when user is inactive", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_STORED_TOKEN]); // look up token
      mockWhere.mockResolvedValueOnce([]); // delete
      mockWhere.mockResolvedValueOnce([{ ...MOCK_USER, isActive: false }]); // user inactive

      await expect(refresh("old-refresh-token")).rejects.toThrow(UnauthorizedError);
    });

    it("deletes old token before issuing new one", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_STORED_TOKEN]);
      mockWhere.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]);

      await refresh("old-refresh-token");

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("stores new refresh token in DB", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_STORED_TOKEN]);
      mockWhere.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      mockWhere.mockResolvedValueOnce([{ slug: "user:read" }]);

      await refresh("old-refresh-token");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-uuid",
          token: "new-refresh-token",
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  // --- changePassword ---

  describe("changePassword", () => {
    beforeEach(() => {
      mockDb.transaction.mockImplementation(
        async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
      );
    });

    it("updates password hash and revokes all refresh tokens on success", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]); // find user
      vi.mocked(hashPassword).mockResolvedValueOnce("new-hashed-password");
      mockWhere.mockResolvedValueOnce(undefined); // tx.update.set.where
      mockWhere.mockResolvedValueOnce(undefined); // tx.delete.where

      await changePassword("user-uuid", {
        oldPassword: "password123",
        newPassword: "newpassword123",
      });

      expect(verifyPassword).toHaveBeenCalledWith("password123", "hashed-password");
      expect(hashPassword).toHaveBeenCalledWith("newpassword123");
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.delete).toHaveBeenCalled();
    });

    it("throws NotFoundError when user not found", async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(
        changePassword("user-uuid", { oldPassword: "password123", newPassword: "newpassword123" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws UnauthorizedError when old password is wrong", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);
      vi.mocked(verifyPassword).mockResolvedValueOnce(false);

      await expect(
        changePassword("user-uuid", { oldPassword: "wrong", newPassword: "newpassword123" }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  // --- requestPasswordReset ---

  describe("requestPasswordReset", () => {
    it("returns resetToken when user is found by email", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]);

      const result = await requestPasswordReset("test@example.com");

      expect(signResetToken).toHaveBeenCalledWith({ sub: "user-uuid" });
      expect(result).toEqual({ resetToken: "reset-token" });
    });

    it("throws NotFoundError when email is not found", async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(requestPasswordReset("unknown@example.com")).rejects.toThrow(NotFoundError);
    });
  });

  // --- resetPassword ---

  describe("resetPassword", () => {
    beforeEach(() => {
      mockDb.transaction.mockImplementation(
        async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
      );
    });

    it("updates password hash and revokes all refresh tokens on success", async () => {
      mockWhere.mockResolvedValueOnce([MOCK_USER]); // find user by sub
      vi.mocked(hashPassword).mockResolvedValueOnce("new-hashed-password");
      mockWhere.mockResolvedValueOnce(undefined); // tx.update.set.where
      mockWhere.mockResolvedValueOnce(undefined); // tx.delete.where

      await resetPassword({ token: "reset-token", newPassword: "newpassword123" });

      expect(mockVerifyResetToken).toHaveBeenCalledWith("reset-token");
      expect(hashPassword).toHaveBeenCalledWith("newpassword123");
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.delete).toHaveBeenCalled();
    });

    it("throws UnauthorizedError when reset token is invalid", async () => {
      mockVerifyResetToken.mockImplementationOnce(() => {
        throw new UnauthorizedError("Invalid or expired reset token");
      });

      await expect(
        resetPassword({ token: "bad-token", newPassword: "newpassword123" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws NotFoundError when user from token is not found", async () => {
      mockWhere.mockResolvedValueOnce([]); // user not found

      await expect(
        resetPassword({ token: "reset-token", newPassword: "newpassword123" }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
