import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHash = vi.fn();
const mockVerify = vi.fn();

vi.mock("argon2", () => ({
  default: {
    hash: mockHash,
    verify: mockVerify,
    argon2id: 2,
  },
}));

describe("utils/password.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashPassword()", () => {
    it("calls argon2.hash with argon2id type and returns hash", async () => {
      mockHash.mockResolvedValue("$argon2id$hashed");

      const { hashPassword } = await import("../password.js");
      const result = await hashPassword("mypassword");

      expect(mockHash).toHaveBeenCalledWith("mypassword", { type: 2 });
      expect(result).toBe("$argon2id$hashed");
    });

    it("propagates errors from argon2", async () => {
      mockHash.mockRejectedValue(new Error("hash failed"));

      const { hashPassword } = await import("../password.js");
      await expect(hashPassword("mypassword")).rejects.toThrow("hash failed");
    });
  });

  describe("verifyPassword()", () => {
    it("returns true when password matches hash", async () => {
      mockVerify.mockResolvedValue(true);

      const { verifyPassword } = await import("../password.js");
      const result = await verifyPassword("mypassword", "$argon2id$hashed");

      expect(mockVerify).toHaveBeenCalledWith("$argon2id$hashed", "mypassword");
      expect(result).toBe(true);
    });

    it("returns false when password does not match", async () => {
      mockVerify.mockResolvedValue(false);

      const { verifyPassword } = await import("../password.js");
      const result = await verifyPassword("wrong", "$argon2id$hashed");

      expect(result).toBe(false);
    });
  });
});
