import { eq, and, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, profiles, userRoles } from "../db/schema/index.js";
import { hashPassword } from "../utils/password.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import type {
  CreateUserInput,
  ListUsersInput,
  UpdateUserInput,
  UpdateUserRolesInput,
} from "../validators/users.validators.js";

export async function createUser(
  data: CreateUserInput,
): Promise<{ id: string; email: string; createdAt: Date }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, data.email));
    if (existing) throw new ConflictError("Email already in use");

    const passwordHash = await hashPassword(data.password);
    const [user] = await tx
      .insert(users)
      .values({ email: data.email, passwordHash })
      .returning();

    await tx.insert(profiles).values({
      userId: user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl,
    });

    await tx
      .insert(userRoles)
      .values(data.roleIds.map((roleId) => ({ userId: user.id, roleId })));

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });
}

export async function listUsers(filters: ListUsersInput): Promise<{
  users: Array<{
    id: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const conditions = [];
  if (filters.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(users).where(whereClause);

  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(whereClause)
    .limit(filters.limit)
    .offset(offset);

  const totalNum = Number(total);
  return {
    users: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: totalNum,
      totalPages: totalNum === 0 ? 0 : Math.ceil(totalNum / filters.limit),
    },
  };
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
): Promise<{ id: string; email: string; isActive: boolean; updatedAt: Date }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.id, id));
    if (!existing) throw new NotFoundError("User not found");

    const { isActive, firstName, lastName, avatarUrl } = data;

    let updated = existing;

    if (isActive !== undefined) {
      const [row] = await tx
        .update(users)
        .set({ isActive })
        .where(eq(users.id, id))
        .returning();
      updated = row;
    }

    if (firstName !== undefined || lastName !== undefined || avatarUrl !== undefined) {
      await tx
        .update(profiles)
        .set({ firstName, lastName, avatarUrl })
        .where(eq(profiles.userId, id));
    }

    return { id: updated.id, email: updated.email, isActive: updated.isActive, updatedAt: updated.updatedAt };
  });
}

export async function updateUserRoles(
  userId: string,
  data: UpdateUserRolesInput,
): Promise<void> {
  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  if (!existing) throw new NotFoundError("User not found");

  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(data.roleIds.map((roleId) => ({ userId, roleId })));
  });
}
