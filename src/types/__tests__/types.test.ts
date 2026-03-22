import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  User,
  NewUser,
  Profile,
  NewProfile,
  Role,
  NewRole,
  Permission,
  NewPermission,
  RolePermission,
  NewRolePermission,
  UserRole,
  NewUserRole,
  RefreshToken,
  NewRefreshToken,
  JwtPayload,
  ApiResponse,
} from "../index.js";

describe("Drizzle-inferred types", () => {
  it("User has expected select fields", () => {
    expectTypeOf<User>().toHaveProperty("id");
    expectTypeOf<User>().toHaveProperty("email");
    expectTypeOf<User>().toHaveProperty("passwordHash");
    expectTypeOf<User>().toHaveProperty("isActive");
    expectTypeOf<User>().toHaveProperty("createdAt");
    expectTypeOf<User>().toHaveProperty("updatedAt");
  });

  it("NewUser requires email and passwordHash", () => {
    expectTypeOf<NewUser>().toHaveProperty("email");
    expectTypeOf<NewUser>().toHaveProperty("passwordHash");
  });

  it("Profile has expected select fields", () => {
    expectTypeOf<Profile>().toHaveProperty("id");
    expectTypeOf<Profile>().toHaveProperty("userId");
    expectTypeOf<Profile>().toHaveProperty("firstName");
    expectTypeOf<Profile>().toHaveProperty("lastName");
    expectTypeOf<Profile>().toHaveProperty("avatarUrl");
  });

  it("NewProfile requires userId", () => {
    expectTypeOf<NewProfile>().toHaveProperty("userId");
  });

  it("Role has expected select fields", () => {
    expectTypeOf<Role>().toHaveProperty("id");
    expectTypeOf<Role>().toHaveProperty("name");
    expectTypeOf<Role>().toHaveProperty("slug");
    expectTypeOf<Role>().toHaveProperty("createdAt");
  });

  it("NewRole requires name and slug", () => {
    expectTypeOf<NewRole>().toHaveProperty("name");
    expectTypeOf<NewRole>().toHaveProperty("slug");
  });

  it("Permission has expected select fields", () => {
    expectTypeOf<Permission>().toHaveProperty("id");
    expectTypeOf<Permission>().toHaveProperty("slug");
    expectTypeOf<Permission>().toHaveProperty("description");
    expectTypeOf<Permission>().toHaveProperty("createdAt");
  });

  it("NewPermission requires slug", () => {
    expectTypeOf<NewPermission>().toHaveProperty("slug");
  });

  it("RolePermission has composite key fields", () => {
    expectTypeOf<RolePermission>().toHaveProperty("roleId");
    expectTypeOf<RolePermission>().toHaveProperty("permissionId");
  });

  it("NewRolePermission requires both foreign keys", () => {
    expectTypeOf<NewRolePermission>().toHaveProperty("roleId");
    expectTypeOf<NewRolePermission>().toHaveProperty("permissionId");
  });

  it("UserRole has composite key fields", () => {
    expectTypeOf<UserRole>().toHaveProperty("userId");
    expectTypeOf<UserRole>().toHaveProperty("roleId");
  });

  it("NewUserRole requires both foreign keys", () => {
    expectTypeOf<NewUserRole>().toHaveProperty("userId");
    expectTypeOf<NewUserRole>().toHaveProperty("roleId");
  });

  it("RefreshToken has expected select fields", () => {
    expectTypeOf<RefreshToken>().toHaveProperty("id");
    expectTypeOf<RefreshToken>().toHaveProperty("userId");
    expectTypeOf<RefreshToken>().toHaveProperty("token");
    expectTypeOf<RefreshToken>().toHaveProperty("expiresAt");
    expectTypeOf<RefreshToken>().toHaveProperty("createdAt");
  });

  it("NewRefreshToken requires userId, token, and expiresAt", () => {
    expectTypeOf<NewRefreshToken>().toHaveProperty("userId");
    expectTypeOf<NewRefreshToken>().toHaveProperty("token");
    expectTypeOf<NewRefreshToken>().toHaveProperty("expiresAt");
  });
});

describe("JwtPayload", () => {
  it("has sub, email, and permissions fields", () => {
    expectTypeOf<JwtPayload>().toHaveProperty("sub");
    expectTypeOf<JwtPayload>().toHaveProperty("email");
    expectTypeOf<JwtPayload>().toHaveProperty("permissions");
  });

  it("sub and email are strings, permissions is string[]", () => {
    expectTypeOf<JwtPayload["sub"]>().toBeString();
    expectTypeOf<JwtPayload["email"]>().toBeString();
    expectTypeOf<JwtPayload["permissions"]>().toEqualTypeOf<string[]>();
  });

  it("is assignable with valid data", () => {
    const payload: JwtPayload = {
      sub: "user-id",
      email: "test@example.com",
      permissions: ["user:read"],
    };
    expect(payload.sub).toBe("user-id");
    expect(payload.email).toBe("test@example.com");
    expect(payload.permissions).toEqual(["user:read"]);
  });
});

describe("ApiResponse", () => {
  it("success response shape", () => {
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: "123" },
    };
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe("123");
  });

  it("error response shape", () => {
    const response: ApiResponse<never> = {
      success: false,
      error: "Something went wrong",
    };
    expect(response.success).toBe(false);
    expect(response.error).toBe("Something went wrong");
  });

  it("has correct type structure", () => {
    expectTypeOf<ApiResponse<string>>().toHaveProperty("success");
    expectTypeOf<ApiResponse<string>>().toHaveProperty("data");
    expectTypeOf<ApiResponse<string>>().toHaveProperty("error");
  });
});

describe("Express Request augmentation", () => {
  it("Request.user accepts JwtPayload", () => {
    // This test validates that the Express augmentation compiles correctly
    const mockReq = {} as import("express").Request;
    expectTypeOf(mockReq.user).toEqualTypeOf<JwtPayload | undefined>();
  });
});
