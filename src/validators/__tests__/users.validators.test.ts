import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  updateUserRolesSchema,
} from "../users.validators.js";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("validators/users.validators.ts", () => {
  describe("createUserSchema", () => {
    it("accepts valid full input with all fields", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "password123",
        firstName: "Alice",
        lastName: "Smith",
        avatarUrl: "https://example.com/avatar.png",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(true);
    });

    it("accepts input without optional fields", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "password123",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(true);
    });

    it("normalizes email to lowercase", () => {
      const result = createUserSchema.safeParse({
        email: "Admin@Example.COM",
        password: "password123",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBe("admin@example.com");
    });

    it("trims whitespace from email", () => {
      const result = createUserSchema.safeParse({
        email: "  admin@example.com  ",
        password: "password123",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBe("admin@example.com");
    });

    it("rejects missing email", () => {
      const result = createUserSchema.safeParse({
        password: "password123",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
      const result = createUserSchema.safeParse({
        email: "not-an-email",
        password: "password123",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 characters", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "short",
        roleIds: [validUuid],
      });
      expect(result.success).toBe(false);
    });

    it("rejects password longer than 128 characters", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "a".repeat(129),
        roleIds: [validUuid],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty roleIds array", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "password123",
        roleIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects roleIds with non-UUID entries", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "password123",
        roleIds: ["not-a-uuid"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing roleIds", () => {
      const result = createUserSchema.safeParse({
        email: "admin@example.com",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("listUsersSchema", () => {
    it("applies defaults when no input provided", () => {
      const result = listUsersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.isActive).toBeUndefined();
      }
    });

    it("coerces string page and limit to numbers", () => {
      const result = listUsersSchema.safeParse({ page: "2", limit: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it("transforms isActive='true' to boolean true", () => {
      const result = listUsersSchema.safeParse({ isActive: "true" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });

    it("transforms isActive='false' to boolean false", () => {
      const result = listUsersSchema.safeParse({ isActive: "false" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(false);
    });

    it("keeps isActive undefined when not provided", () => {
      const result = listUsersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBeUndefined();
    });

    it("rejects page less than 1", () => {
      const result = listUsersSchema.safeParse({ page: "0" });
      expect(result.success).toBe(false);
    });

    it("rejects limit greater than 100", () => {
      const result = listUsersSchema.safeParse({ limit: "101" });
      expect(result.success).toBe(false);
    });
  });

  describe("updateUserSchema", () => {
    it("accepts partial input with only firstName", () => {
      const result = updateUserSchema.safeParse({ firstName: "Alice" });
      expect(result.success).toBe(true);
    });

    it("accepts partial input with only isActive", () => {
      const result = updateUserSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it("accepts all fields together", () => {
      const result = updateUserSchema.safeParse({
        firstName: "Alice",
        lastName: "Smith",
        avatarUrl: "https://example.com/avatar.png",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects completely empty object", () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid avatarUrl", () => {
      const result = updateUserSchema.safeParse({ avatarUrl: "not-a-url" });
      expect(result.success).toBe(false);
    });
  });

  describe("updateUserRolesSchema", () => {
    it("accepts valid roleIds array with one UUID", () => {
      const result = updateUserRolesSchema.safeParse({ roleIds: [validUuid] });
      expect(result.success).toBe(true);
    });

    it("accepts multiple UUIDs", () => {
      const result = updateUserRolesSchema.safeParse({
        roleIds: [validUuid, "660e8400-e29b-41d4-a716-446655440000"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty array", () => {
      const result = updateUserRolesSchema.safeParse({ roleIds: [] });
      expect(result.success).toBe(false);
    });

    it("rejects non-UUID strings in roleIds", () => {
      const result = updateUserRolesSchema.safeParse({ roleIds: ["not-a-uuid"] });
      expect(result.success).toBe(false);
    });

    it("rejects missing roleIds", () => {
      const result = updateUserRolesSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
