import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "../auth.validators.js";

describe("validators/auth.validators.ts", () => {
  describe("registerSchema", () => {
    it("accepts valid full input", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        firstName: "Alice",
        lastName: "Smith",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid input without optional fields", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password longer than 128 characters", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(129),
      });
      expect(result.success).toBe(false);
    });

    it("normalizes email to lowercase", () => {
      const result = registerSchema.safeParse({
        email: "USER@EXAMPLE.COM",
        password: "password123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("trims whitespace from email", () => {
      const result = registerSchema.safeParse({
        email: "  user@example.com  ",
        password: "password123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("rejects missing email", () => {
      const result = registerSchema.safeParse({ password: "password123" });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = registerSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "anypassword",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
      const result = loginSchema.safeParse({
        email: "not-valid",
        password: "anypassword",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing email", () => {
      const result = loginSchema.safeParse({ password: "anypassword" });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = loginSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(false);
    });

    it("accepts short passwords (service layer does real check)", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "abc",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("changePasswordSchema", () => {
    it("accepts valid old and new password", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldpass123",
        newPassword: "newpass123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty oldPassword", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "",
        newPassword: "newpass123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects newPassword shorter than 8 characters", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldpass123",
        newPassword: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects newPassword longer than 128 characters", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldpass123",
        newPassword: "a".repeat(129),
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing oldPassword", () => {
      const result = changePasswordSchema.safeParse({ newPassword: "newpass123" });
      expect(result.success).toBe(false);
    });

    it("rejects missing newPassword", () => {
      const result = changePasswordSchema.safeParse({ oldPassword: "oldpass123" });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("accepts valid token and new password", () => {
      const result = resetPasswordSchema.safeParse({
        token: "some.jwt.token",
        newPassword: "newpass123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty token", () => {
      const result = resetPasswordSchema.safeParse({
        token: "",
        newPassword: "newpass123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects newPassword shorter than 8 characters", () => {
      const result = resetPasswordSchema.safeParse({
        token: "some.jwt.token",
        newPassword: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects newPassword longer than 128 characters", () => {
      const result = resetPasswordSchema.safeParse({
        token: "some.jwt.token",
        newPassword: "a".repeat(129),
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing token", () => {
      const result = resetPasswordSchema.safeParse({ newPassword: "newpass123" });
      expect(result.success).toBe(false);
    });

    it("rejects missing newPassword", () => {
      const result = resetPasswordSchema.safeParse({ token: "some.jwt.token" });
      expect(result.success).toBe(false);
    });
  });
});
