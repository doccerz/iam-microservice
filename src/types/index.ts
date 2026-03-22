import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  profiles,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  refreshTokens,
} from "../db/schema/index.js";

// Drizzle-inferred entity types

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;

export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;

export type Permission = InferSelectModel<typeof permissions>;
export type NewPermission = InferInsertModel<typeof permissions>;

export type RolePermission = InferSelectModel<typeof rolePermissions>;
export type NewRolePermission = InferInsertModel<typeof rolePermissions>;

export type UserRole = InferSelectModel<typeof userRoles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

// JWT payload embedded in access tokens

export interface JwtPayload {
  sub: string;
  email: string;
  permissions: string[];
}

// Standard API response envelope

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
