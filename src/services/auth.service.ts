import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  profiles,
  roles,
  userRoles,
  rolePermissions,
  permissions,
  refreshTokens,
} from "../db/schema/index.js";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken, signResetToken, verifyRefreshToken, verifyResetToken } from "../utils/jwt.js";
import { ConflictError, UnauthorizedError, NotFoundError } from "../utils/errors.js";
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  ResetPasswordInput,
} from "../validators/auth.validators.js";

function parseExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  if (unit === "d") return value * 24 * 60 * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "m") return value * 60 * 1000;
  if (unit === "s") return value * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: permissions.slug })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.slug);
}

export async function register(data: RegisterInput) {
  const { email, password, firstName, lastName } = data;

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, email));
    if (existing) throw new ConflictError("Email already in use");

    const passwordHash = await hashPassword(password);

    const [user] = await tx.insert(users).values({ email, passwordHash }).returning();

    await tx.insert(profiles).values({ userId: user.id, firstName, lastName });

    const [defaultRole] = await tx
      .select()
      .from(roles)
      .where(eq(roles.slug, env.DEFAULT_ROLE_SLUG));

    if (defaultRole) {
      await tx.insert(userRoles).values({ userId: user.id, roleId: defaultRole.id });
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });
}

export async function login(data: LoginInput) {
  const { email, password } = data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.isActive) throw new UnauthorizedError("Invalid credentials");

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) throw new UnauthorizedError("Invalid credentials");

  const userPermissions = await getUserPermissions(user.id);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    permissions: userPermissions,
  });
  const refreshToken = signRefreshToken({ sub: user.id });

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + parseExpiry(env.JWT_REFRESH_EXPIRY)),
  });

  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

export async function refresh(token: string) {
  const { sub: userId } = verifyRefreshToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token));
  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.isActive) throw new UnauthorizedError("Invalid or expired refresh token");

  const userPermissions = await getUserPermissions(userId);

  const accessToken = signAccessToken({
    sub: userId,
    email: user.email,
    permissions: userPermissions,
  });
  const newRefreshToken = signRefreshToken({ sub: userId });

  await db.insert(refreshTokens).values({
    userId,
    token: newRefreshToken,
    expiresAt: new Date(Date.now() + parseExpiry(env.JWT_REFRESH_EXPIRY)),
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("User not found");

  const isValid = await verifyPassword(data.oldPassword, user.passwordHash);
  if (!isValid) throw new UnauthorizedError("Invalid credentials");

  const newHash = await hashPassword(data.newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}

export async function requestPasswordReset(email: string): Promise<{ resetToken: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new NotFoundError("User not found");

  const resetToken = signResetToken({ sub: user.id });
  return { resetToken };
}

export async function resetPassword(data: ResetPasswordInput): Promise<void> {
  const { sub: userId } = verifyResetToken(data.token);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("User not found");

  const newHash = await hashPassword(data.newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}
