import { inArray } from "drizzle-orm";
import { db, sql } from "./index.js";
import { permissions, roles, rolePermissions } from "./schema/index.js";

const SEED_PERMISSIONS = [
  { slug: "user:read", description: "Read user data" },
  { slug: "user:write", description: "Create and update users" },
  { slug: "user:delete", description: "Delete users" },
  { slug: "role:read", description: "Read roles" },
  { slug: "role:write", description: "Create and update roles" },
];

const SEED_ROLES = [
  { name: "Admin", slug: "admin" },
  { name: "User", slug: "user" },
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin: ["user:read", "user:write", "user:delete", "role:read", "role:write"],
  user: ["user:read"],
};

export async function seedDatabase(): Promise<void> {
  console.log("Seeding database...");

  // Insert permissions (idempotent)
  await db.insert(permissions).values(SEED_PERMISSIONS).onConflictDoNothing();

  // Insert roles (idempotent)
  await db.insert(roles).values(SEED_ROLES).onConflictDoNothing();

  // Query back to get IDs reliably (onConflictDoNothing returns empty on conflict)
  const allPermissions = await db
    .select()
    .from(permissions)
    .where(
      inArray(
        permissions.slug,
        SEED_PERMISSIONS.map((p) => p.slug),
      ),
    );

  const allRoles = await db
    .select()
    .from(roles)
    .where(
      inArray(
        roles.slug,
        SEED_ROLES.map((r) => r.slug),
      ),
    );

  // Build role-permission mappings
  const permBySlug = new Map(allPermissions.map((p) => [p.slug, p.id]));
  const roleBySlug = new Map(allRoles.map((r) => [r.slug, r.id]));

  const rolePermissionValues = Object.entries(ROLE_PERMISSION_MAP).flatMap(
    ([roleSlug, permSlugs]) => {
      const roleId = roleBySlug.get(roleSlug)!;
      return permSlugs.map((permSlug) => ({
        roleId,
        permissionId: permBySlug.get(permSlug)!,
      }));
    },
  );

  // Insert role-permission mappings (idempotent)
  await db
    .insert(rolePermissions)
    .values(rolePermissionValues)
    .onConflictDoNothing();

  console.log("Seeding complete.");
}

if (require.main === module) {
  seedDatabase()
    .then(() => sql.end())
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
