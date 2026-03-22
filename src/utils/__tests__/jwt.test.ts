import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSign = vi.fn();
const mockJwtVerify = vi.fn();

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mockSign,
    verify: mockJwtVerify,
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
  },
}));

describe("utils/jwt.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signAccessToken()", () => {
    it("calls jwt.sign with payload, access secret, and expiry", async () => {
      mockSign.mockReturnValue("access-token-123");

      const { signAccessToken } = await import("../jwt.js");
      const payload = { sub: "user-1", email: "a@b.com", permissions: ["user:read"] };
      const result = signAccessToken(payload);

      expect(mockSign).toHaveBeenCalledWith(payload, "test-access-secret", {
        expiresIn: "15m",
      });
      expect(result).toBe("access-token-123");
    });
  });

  describe("signRefreshToken()", () => {
    it("calls jwt.sign with { sub }, refresh secret, and expiry", async () => {
      mockSign.mockReturnValue("refresh-token-123");

      const { signRefreshToken } = await import("../jwt.js");
      const result = signRefreshToken({ sub: "user-1" });

      expect(mockSign).toHaveBeenCalledWith({ sub: "user-1" }, "test-refresh-secret", {
        expiresIn: "7d",
      });
      expect(result).toBe("refresh-token-123");
    });
  });

  describe("verifyAccessToken()", () => {
    it("returns clean JwtPayload on success", async () => {
      mockJwtVerify.mockReturnValue({
        sub: "user-1",
        email: "a@b.com",
        permissions: ["user:read"],
        iat: 123,
        exp: 456,
      });

      const { verifyAccessToken } = await import("../jwt.js");
      const result = verifyAccessToken("valid-token");

      expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", "test-access-secret");
      expect(result).toEqual({
        sub: "user-1",
        email: "a@b.com",
        permissions: ["user:read"],
      });
    });

    it("throws UnauthorizedError on invalid token", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      const { verifyAccessToken } = await import("../jwt.js");
      const { UnauthorizedError } = await import("../errors.js");

      expect(() => verifyAccessToken("bad-token")).toThrow(UnauthorizedError);
    });
  });

  describe("verifyRefreshToken()", () => {
    it("returns { sub } on success", async () => {
      mockJwtVerify.mockReturnValue({
        sub: "user-1",
        iat: 123,
        exp: 456,
      });

      const { verifyRefreshToken } = await import("../jwt.js");
      const result = verifyRefreshToken("valid-refresh-token");

      expect(mockJwtVerify).toHaveBeenCalledWith("valid-refresh-token", "test-refresh-secret");
      expect(result).toEqual({ sub: "user-1" });
    });

    it("throws UnauthorizedError on invalid token", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      const { verifyRefreshToken } = await import("../jwt.js");
      const { UnauthorizedError } = await import("../errors.js");

      expect(() => verifyRefreshToken("bad-token")).toThrow(UnauthorizedError);
    });
  });
});
